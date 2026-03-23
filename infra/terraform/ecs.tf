data "aws_caller_identity" "current" {}

# ─── ECS Cluster ──────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = var.app_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ─── IAM Roles ────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.app_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow task execution role to read secrets
resource "aws_iam_role_policy" "ecs_secrets" {
  name = "${var.app_name}-ecs-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.app_name}/*"
    }]
  })
}

# Task role — permissions the running container has
resource "aws_iam_role" "ecs_task" {
  name = "${var.app_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# ─── CloudWatch Log Group ─────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "services" {
  for_each          = toset(local.services)
  name              = "/ecs/${var.app_name}/${each.key}"
  retention_in_days = 14
}

# ─── ECS Task Definitions ─────────────────────────────────────────────────────
locals {
  service_ports = {
    web                = 3000
    api-gateway        = 3001
    github-service     = 3002
    ai-service         = 3003
    embeddings-service = 3004
    repo-qa-service    = 3005
  }

  # Environment variables injected from Secrets Manager
  common_secrets = [
    { name = "DATABASE_URL",          valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::" },
    { name = "JWT_SECRET",            valueFrom = "${aws_secretsmanager_secret.app.arn}:JWT_SECRET::" },
    { name = "GEMINI_API_KEY",         valueFrom = "${aws_secretsmanager_secret.app.arn}:GEMINI_API_KEY::" },
    { name = "GITHUB_CLIENT_ID",      valueFrom = "${aws_secretsmanager_secret.app.arn}:GITHUB_CLIENT_ID::" },
    { name = "GITHUB_CLIENT_SECRET",  valueFrom = "${aws_secretsmanager_secret.app.arn}:GITHUB_CLIENT_SECRET::" },
    { name = "GITHUB_WEBHOOK_SECRET", valueFrom = "${aws_secretsmanager_secret.app.arn}:GITHUB_WEBHOOK_SECRET::" },
  ]
}

resource "aws_ecs_task_definition" "services" {
  for_each = toset(local.services)

  family                   = "${var.app_name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = lookup(var.service_cpu, each.key, 256)
  memory                   = lookup(var.service_memory, each.key, 512)
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = each.key
    image = "${aws_ecr_repository.services[each.key].repository_url}:${var.ecr_image_tag}"

    portMappings = [{
      containerPort = local.service_ports[each.key]
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV",                value = "production" },
      { name = "EMBEDDING_PROVIDER",      value = "gemini" },
      { name = "API_GATEWAY_PORT",        value = "3001" },
      { name = "GITHUB_SERVICE_PORT",     value = "3002" },
      { name = "AI_SERVICE_PORT",         value = "3003" },
      { name = "EMBEDDINGS_SERVICE_PORT", value = "3004" },
      { name = "REPO_QA_SERVICE_PORT",    value = "3005" },
    ]

    secrets = local.common_secrets

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = "/ecs/${var.app_name}/${each.key}"
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:${local.service_ports[each.key]}/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

# ─── ECS Services ─────────────────────────────────────────────────────────────
resource "aws_ecs_service" "services" {
  for_each        = toset(local.services)
  name            = "${var.app_name}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = lookup(var.service_desired_count, each.key, 1)
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.services[each.key].arn
    container_name   = each.key
    container_port   = local.service_ports[each.key]
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  # Ignore task definition changes — CI/CD updates these via aws ecs update-service
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_lb_listener.https]
}

# ─── Auto Scaling ─────────────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "services" {
  for_each           = toset(["ai-service", "embeddings-service"])
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.services[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each           = aws_appautoscaling_target.services
  name               = "${var.app_name}-${each.key}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = each.value.resource_id
  scalable_dimension = each.value.scalable_dimension
  service_namespace  = each.value.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

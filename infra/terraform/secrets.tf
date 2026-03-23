# ─── Secrets Manager ─────────────────────────────────────────────────────────
# Single secret with all app config as a JSON object.
# Populate via AWS console or: aws secretsmanager put-secret-value --secret-id ...

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.app_name}/config"
  description             = "AI Developer Platform application secrets"
  recovery_window_in_days = 7
}

# Placeholder — real values must be set out-of-band (never in Terraform state)
resource "aws_secretsmanager_secret_version" "app_placeholder" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL          = "postgresql://${var.db_username}:CHANGE_ME@${aws_db_instance.main.endpoint}/${var.db_name}"
    JWT_SECRET            = "CHANGE_ME_min_32_chars"
    ANTHROPIC_API_KEY     = "CHANGE_ME"
    VOYAGE_API_KEY        = "CHANGE_ME"
    GITHUB_CLIENT_ID      = "CHANGE_ME"
    GITHUB_CLIENT_SECRET  = "CHANGE_ME"
    GITHUB_WEBHOOK_SECRET = "CHANGE_ME"
  })

  lifecycle {
    # Prevent Terraform from overwriting secrets changed outside Terraform
    ignore_changes = [secret_string]
  }
}

# ─── OIDC Provider for GitHub Actions ────────────────────────────────────────
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

variable "github_repo" {
  description = "GitHub repo in owner/name format (for OIDC trust)"
  type        = string
  default     = "your-org/ai-developer-platform"
}

resource "aws_iam_role" "github_deploy" {
  name = "${var.app_name}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/main"
        }
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "${var.app_name}-github-deploy-policy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:ListTaskDefinitions",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = aws_iam_role.ecs_task_execution.arn
      }
    ]
  })
}

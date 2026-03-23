# ─── Application Load Balancer ────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = true

  tags = { Name = "${var.app_name}-alb" }
}

# ─── Target Groups ────────────────────────────────────────────────────────────
resource "aws_lb_target_group" "services" {
  for_each    = toset(local.services)
  name        = "${var.app_name}-${each.key}"
  port        = local.service_ports[each.key]
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  # SSE requires long-lived connections — increase deregistration delay
  deregistration_delay = each.key == "ai-service" || each.key == "repo-qa-service" ? 60 : 30

  tags = { Name = "${var.app_name}-${each.key}-tg" }
}

# ─── HTTP Listener (redirects to HTTPS) ──────────────────────────────────────
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ─── HTTPS Listener with path-based routing ──────────────────────────────────
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn

  # Default: route to web (Next.js)
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["web"].arn
  }
}

# Path-based rules — API routes go to api-gateway
resource "aws_lb_listener_rule" "api_gateway" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.services["api-gateway"].arn
  }

  condition {
    path_pattern { values = ["/api/*", "/health"] }
  }
}

# ─── ACM Certificate ──────────────────────────────────────────────────────────
variable "domain_name" {
  description = "Domain name for the ALB certificate (e.g. app.yourdomain.com)"
  type        = string
  default     = "app.example.com"
}

resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn = aws_acm_certificate.main.arn
  # Add the DNS validation CNAME records to your DNS provider.
  # Outputs the required records in outputs.tf.
}

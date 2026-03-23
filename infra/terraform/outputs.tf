output "alb_dns_name" {
  description = "DNS name of the ALB — point your domain CNAME here"
  value       = aws_lb.main.dns_name
}

output "ecr_registry" {
  description = "ECR registry URL prefix"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "ecr_repos" {
  description = "ECR repository URLs per service"
  value       = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "github_deploy_role_arn" {
  description = "ARN for the GitHub Actions OIDC deploy role — add to AWS_DEPLOY_ROLE_ARN secret"
  value       = aws_iam_role.github_deploy.arn
}

output "acm_dns_validation" {
  description = "DNS records to add for ACM certificate validation"
  value = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}

output "secrets_manager_arn" {
  description = "Secrets Manager ARN — update with real values after apply"
  value       = aws_secretsmanager_secret.app.arn
}

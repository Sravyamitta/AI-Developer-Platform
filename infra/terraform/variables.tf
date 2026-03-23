variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Application name prefix"
  type        = string
  default     = "ai-platform"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AZs to deploy subnets into"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "db_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "ai_dev_platform"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "PostgreSQL master password (store in Secrets Manager, not here)"
  type        = string
  sensitive   = true
}

# Container CPU/memory per service (Fargate units)
variable "service_cpu" {
  type    = map(number)
  default = {
    web                 = 512
    api-gateway         = 256
    github-service      = 256
    ai-service          = 512
    embeddings-service  = 512
    repo-qa-service     = 256
  }
}

variable "service_memory" {
  type    = map(number)
  default = {
    web                 = 1024
    api-gateway         = 512
    github-service      = 512
    ai-service          = 1024
    embeddings-service  = 1024
    repo-qa-service     = 512
  }
}

variable "service_desired_count" {
  description = "Desired number of tasks per service"
  type        = map(number)
  default = {
    web                 = 1
    api-gateway         = 1
    github-service      = 1
    ai-service          = 1
    embeddings-service  = 1
    repo-qa-service     = 1
  }
}

variable "ecr_image_tag" {
  description = "Docker image tag to deploy (set via CI)"
  type        = string
  default     = "latest"
}

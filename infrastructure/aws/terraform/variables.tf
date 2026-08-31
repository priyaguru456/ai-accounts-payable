variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "ap-automation"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_password" {
  type      = string
  sensitive = true
  # No default on purpose: pass via TF_VAR_db_password or terraform.tfvars (git-ignored),
  # never commit a real password here.
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "backend_image" {
  type = string
}

variable "worker_image" {
  type = string
}

variable "ai_service_image" {
  type = string
}

# NOT APPLIED: no AWS account/credentials are configured for this project. This is
# reviewable IaC for the architecture described in infrastructure/aws/README.md — run
# `terraform init && terraform plan` only once you have a real AWS account and have
# filled in terraform.tfvars (see terraform.tfvars.example).
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

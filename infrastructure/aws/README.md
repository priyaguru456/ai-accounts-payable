# AWS Deployment

Target architecture: RDS (MySQL) + ElastiCache (Redis) + S3 (invoice documents) + ECS Fargate
(backend, worker, ai-service containers) + CloudFront/S3 or Amplify (frontend static build) +
Secrets Manager (credentials) + an ALB in front of `backend`, with `ai-service` reachable only
from the backend/worker security group (never public).

**Status: no AWS account is configured for this project yet.** `terraform/` contains reviewable
IaC for the above (VPC, RDS, ElastiCache, S3, IAM, ALB, ECS cluster/backend service/autoscaling —
worker and ai-service task definitions follow the same pattern, see the comment at the bottom of
`terraform/ecs.tf`). It has **not been `terraform apply`'d** — do that only once you have:

1. A real AWS account + credentials (`aws configure` or an OIDC role for CI).
2. A domain + ACM certificate (fill in `alb.tf`'s `certificate_arn`).
3. `terraform/terraform.tfvars` created from `terraform.tfvars.example` with real values —
   `db_password`, and the three ECR image URIs (build/push those first — see
   `.github/workflows/deploy.yml`, which is similarly unexecuted until this exists).

```
cd infrastructure/aws/terraform
terraform init
terraform plan   # review before ever running apply
terraform apply
```

## Manual steps still needed after `apply`
1. Populate the real secret values in Secrets Manager (`aws_secretsmanager_secret.app`) — the
   Terraform-managed version is a placeholder (`lifecycle { ignore_changes = [secret_string] }`).
2. Swap `backend/src/services/storageService.js` to `STORAGE_DRIVER=s3` (already implemented,
   see `docs/architecture.md`) and point `S3_BUCKET`/`AWS_REGION` at the Terraform-created bucket.
3. Copy `aws_ecs_task_definition.backend` + `aws_ecs_service.backend` in `ecs.tf` as a template for
   `worker` and `ai-service` (same shape, private subnets, `ai-service` gets no load balancer).
4. **Frontend**: `npm run build` in `frontend/`, upload `dist/` to an S3 bucket served via
   CloudFront, or deploy via AWS Amplify Hosting pointed at this repo's `frontend/` directory
   (not yet in Terraform).

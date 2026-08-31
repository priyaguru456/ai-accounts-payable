resource "aws_secretsmanager_secret" "app" {
  name = "${var.project_name}/${var.environment}/app"
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  # Placeholder JSON — fill in real values via `aws secretsmanager put-secret-value`
  # or a separate, git-ignored terraform.tfvars once real infra exists. Never commit
  # real secrets into this file.
  secret_string = jsonencode({
    DATABASE_URL             = "mysql://app_user:${var.db_password}@${aws_db_instance.mysql.endpoint}/ai_accounts_payable"
    JWT_SECRET                = "CHANGE_ME"
    AI_SERVICE_INTERNAL_KEY   = "CHANGE_ME"
    ANTHROPIC_API_KEY         = "CHANGE_ME"
    FIELD_ENCRYPTION_KEY      = "CHANGE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string] # managed out-of-band after first apply
  }
}

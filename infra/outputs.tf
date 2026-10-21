output "api_url" {
  description = "Base URL over HTTPS (business routes under /api/v1, OpenAPI docs at /docs)."
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_services" {
  description = "Every ECS service of the stack (API, the two workers and RabbitMQ)."
  value       = concat([for service in aws_ecs_service.this : service.name], [aws_ecs_service.rabbitmq.name])
}

output "api_key_parameter" {
  description = "SSM SecureString holding the API key (X-API-Key header)."
  value       = aws_ssm_parameter.secret["API_KEYS"].name
}

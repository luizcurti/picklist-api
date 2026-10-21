# PostgreSQL 17, the version docker-compose and CI use. The app reads a single DATABASE_URL
# (src/config/env.ts), so the password is generated here and the whole URL is stored as an SSM
# SecureString (app.tf) rather than using an RDS-managed secret, which ECS could only inject as
# a separate variable.
#
# TLS: the URL carries sslmode=no-verify, so the pg Pool encrypts the connection without
# shipping the RDS CA bundle in the image. That satisfies RDS's default rds.force_ssl=1, and
# the instance is not publicly accessible anyway (its security group only admits the tasks).

resource "random_password" "db" {
  length  = 40
  special = false # goes into a URL unescaped
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.public[*].id
}

resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = "17"
  instance_class = var.db_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "picklist"
  username = "picklist"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false

  # Demo stack, torn down by the Destroy workflow: no final snapshot, no deletion protection.
  backup_retention_period    = 1
  skip_final_snapshot        = true
  deletion_protection        = false
  apply_immediately          = true
  auto_minor_version_upgrade = true
}

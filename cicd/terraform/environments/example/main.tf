terraform {
  required_version = ">= 1.5.0"

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

########################
## Networking (inputs)
########################

variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where private resources (MSK, Lambdas) will live."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for MSK and Lambdas."
  type        = list(string)
}

variable "lambda_security_group_ids" {
  description = "Security group IDs attached to Lambda functions that need Kafka access."
  type        = list(string)
}

variable "msk_allowed_client_sg_ids" {
  description = "Security group IDs that are allowed to connect to the Kafka brokers."
  type        = list(string)
}

########################
## Shared tagging
########################

variable "project_name" {
  description = "Logical project name for tagging."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)."
  type        = string
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

########################
## Kafka (AWS MSK)
########################

module "kafka_msk" {
  source = "../../modules/kafka-mks"

  cluster_name              = "${var.project_name}-${var.environment}-msk"
  vpc_id                    = var.vpc_id
  subnet_ids                = var.private_subnet_ids
  allowed_client_sg_ids     = var.msk_allowed_client_sg_ids
  broker_instance_type      = "kafka.m7g.large"
  broker_volume_size_gib    = 100
  number_of_broker_nodes    = 3
  encryption_kms_key_arn    = null
  enhanced_monitoring_level = "PER_TOPIC_PER_BROKER"

  tags = local.common_tags
}

########################
## Glue Schema Registry
########################

module "glue_schema_registry" {
  source = "../../modules/glue-schema-registry"

  registry_name        = "${var.project_name}-${var.environment}-registry"
  description          = "Glue Schema Registry for ${var.project_name} (${var.environment})."

  schemas = {
    example = {
      schema_name   = "example-avro-schema"
      compatibility = "BACKWARD"
      definition = <<EOF
{
  "type": "record",
  "name": "ExampleRecord",
  "namespace": "com.example.nacha",
  "fields": [
    { "name": "id", "type": "string" },
    { "name": "timestamp", "type": "long" },
    { "name": "payload", "type": "string" }
  ]
}
EOF
    }
  }

  tags = local.common_tags
}

########################
## Lambda with triggers
########################

variable "lambda_kms_key_arn" {
  description = "Optional KMS key ARN for encrypting Lambda environment variables."
  type        = string
  default     = ""
}

variable "lambda_source_zip_path" {
  description = "Path to the Lambda deployment ZIP (e.g. build output or CI artifact)."
  type        = string
}

module "lambda_with_triggers" {
  source = "../../modules/lambda-with-triggers"

  lambda_name                  = "${var.project_name}-${var.environment}-processor"
  description                  = "Example Lambda that processes messages on a schedule."
  runtime                      = "nodejs20.x"
  handler                      = "index.handler"
  memory_size_mb               = 256
  timeout_seconds              = 30
  vpc_id                       = var.vpc_id
  subnet_ids                   = var.private_subnet_ids
  security_group_ids           = var.lambda_security_group_ids
  source_zip_path              = var.lambda_source_zip_path
  environment_variables        = { EXAMPLE_CONFIG = "true" }
  environment_kms_key_arn      = var.lambda_kms_key_arn != "" ? var.lambda_kms_key_arn : null
  attach_cloudwatch_logs_policy = true

  tags = local.common_tags
}

########################
## EventBridge Scheduler role (required to invoke Lambda)
########################

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

data "aws_iam_policy_document" "scheduler_invoke_lambda" {
  statement {
    effect = "Allow"
    actions = ["lambda:InvokeFunction"]
    resources = [module.lambda_with_triggers.lambda_arn]
  }
}

resource "aws_iam_role" "eventbridge_scheduler" {
  name               = "${var.project_name}-${var.environment}-scheduler-role"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "eventbridge_scheduler_invoke" {
  name   = "InvokeLambda"
  role   = aws_iam_role.eventbridge_scheduler.id
  policy = data.aws_iam_policy_document.scheduler_invoke_lambda.json
}

########################
## EventBridge Schedules
########################

module "eventbridge_schedules" {
  source = "../../modules/eventbridge-schedules"

  schedules = [
    {
      name                = "${var.project_name}-${var.environment}-every-5-mins"
      description         = "Example schedule that triggers the processor Lambda every 5 minutes."
      schedule_expression = "rate(5 minutes)"
      flexible_time_window = {
        mode                      = "OFF"
        maximum_window_in_minutes = null
      }
      target_arn  = module.lambda_with_triggers.lambda_arn
      target_role = aws_iam_role.eventbridge_scheduler.arn
      input       = jsonencode({ source = "scheduler", detailType = "example" })
    }
  ]

  tags = local.common_tags
}


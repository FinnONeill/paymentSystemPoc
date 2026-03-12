variable "lambda_name" {
  description = "Name of the Lambda function."
  type        = string
}

variable "description" {
  description = "Description of the Lambda."
  type        = string
  default     = ""
}

variable "runtime" {
  description = "Runtime for the Lambda function (e.g. nodejs20.x)."
  type        = string
}

variable "handler" {
  description = "Handler entrypoint for the Lambda function."
  type        = string
}

variable "memory_size_mb" {
  description = "Memory size for the Lambda function."
  type        = number
  default     = 256
}

variable "timeout_seconds" {
  description = "Timeout for the Lambda function."
  type        = number
  default     = 30
}

variable "vpc_id" {
  description = "VPC ID for Lambda networking."
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for Lambda ENIs."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs for the Lambda."
  type        = list(string)
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function."
  type        = map(string)
  default     = {}
}

variable "environment_kms_key_arn" {
  description = "Optional KMS key ARN for encrypting environment variables."
  type        = string
  default     = null
}

variable "attach_cloudwatch_logs_policy" {
  description = "Attach AWS managed CloudWatch logs policy to the Lambda role."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags to apply to resources."
  type        = map(string)
  default     = {}
}

variable "source_zip_path" {
  description = "Path to the Lambda deployment package (ZIP file). Required for deployment; set in CI or use a built artifact."
  type        = string
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.lambda_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  count      = var.attach_cloudwatch_logs_policy ? 1 : 0
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "this" {
  function_name = var.lambda_name
  description   = var.description != "" ? var.description : null
  role          = aws_iam_role.lambda.arn
  handler       = var.handler
  runtime       = var.runtime

  memory_size = var.memory_size_mb
  timeout     = var.timeout_seconds

  filename         = var.source_zip_path
  source_code_hash = filebase64sha256(var.source_zip_path)

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []

    content {
      variables = var.environment_variables
    }
  }

  kms_key_arn = var.environment_kms_key_arn

  tags = var.tags
}

output "lambda_arn" {
  description = "ARN of the Lambda function."
  value       = aws_lambda_function.this.arn
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role."
  value       = aws_iam_role.lambda.arn
}


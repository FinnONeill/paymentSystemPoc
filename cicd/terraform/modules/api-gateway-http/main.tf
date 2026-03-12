variable "api_name" {
  description = "Name of the HTTP API."
  type        = string
}

variable "stage_name" {
  description = "Deployment stage name (e.g. dev, prod)."
  type        = string
}

variable "lambda_arn" {
  description = "ARN of the Lambda function to integrate with the API."
  type        = string
}

variable "lambda_invoke_role_arn" {
  description = "IAM role ARN used by API Gateway to invoke the Lambda."
  type        = string
}

variable "tags" {
  description = "Common tags to apply to resources."
  type        = map(string)
  default     = {}
}

resource "aws_apigatewayv2_api" "this" {
  name          = var.api_name
  protocol_type = "HTTP"

  tags = var.tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.lambda_arn
  integration_method     = "POST"
  payload_format_version = "2.0"

  credentials_arn = var.lambda_invoke_role_arn
}

locals {
  # function_name attribute expects the Lambda name only (no version/alias).
  # ARN format: arn:aws:lambda:region:account:function:name[:version-or-alias]
  # Split and take index 6 to get name; qualified ARNs have an extra segment we must ignore.
  lambda_function_name = element(split(":", var.lambda_arn), 6)
}

resource "aws_lambda_permission" "api_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = local.lambda_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "default_any" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "ANY /{proxy+}"

  target = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "this" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = var.stage_name
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }

  tags = var.tags
}

output "invoke_url" {
  description = "Base invoke URL for the HTTP API."
  value       = aws_apigatewayv2_stage.this.invoke_url
}


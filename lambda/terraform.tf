variable "access_key" {}
variable "secret_key" {}
variable "region" {}

variable "github_app_id" {}

variable "sites" {}

terraform {
  required_version = ">= 0.12"
}

locals {
  app = "handx-lambda"
}

data "archive_file" "lambda_zip" {
  type = "zip"
  source_dir = "dist"
  output_path = "dist.zip"
}

provider "aws" {
  access_key = var.access_key
  secret_key = var.secret_key
  region = var.region
}

data "aws_caller_identity" "current" {}

resource "random_string" "webhook_secret" {
  length = 16
}

resource "aws_api_gateway_rest_api" "api" {
  name = "${local.app}-api"
}

resource "aws_api_gateway_resource" "webhook" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id = aws_api_gateway_rest_api.api.root_resource_id
  path_part = "webhook"
}

resource "aws_api_gateway_method" "webhook_post" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.webhook.id
  http_method = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhook_integration" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.webhook.id
  http_method = aws_api_gateway_method.webhook_post.http_method
  integration_http_method = "POST"
  type = "AWS_PROXY"
  uri = aws_lambda_function.webhook.invoke_arn
}

resource "aws_api_gateway_deployment" "api" {
  depends_on = [aws_api_gateway_integration.webhook_integration]
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name = "production"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lambda_function" "webhook" {
  function_name = "${local.app}-webhook"
  filename = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime = "nodejs12.x"
  layers = [
    # https://github.com/lambci/git-lambda-layer
    "arn:aws:lambda:us-east-1:553035198032:layer:git-lambda2:7",
    # https://github.com/shelfio/chrome-aws-lambda-layer
    "arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda:21",
  ]
  memory_size = 1024
  handler = "index.handler"
  environment {
    variables = {
      GITHUB_APP_ID = var.github_app_id
      GITHUB_PRIVATE_KEY = file("github-private-key.pem")
      WEBHOOK_SECRET = random_string.webhook_secret.result
      SITES = jsonencode(var.sites)
    }
  }
  role = aws_iam_role.lambda.arn
  timeout = 90
  reserved_concurrent_executions = 1
  depends_on = [aws_iam_role_policy.lambda]
  tags = {
    Terraform = local.app
  }
}

resource "aws_lambda_permission" "invoke_webhook" {
  action = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook.function_name
  principal = "apigateway.amazonaws.com"
  source_arn = "${aws_api_gateway_rest_api.api.execution_arn}/*/${aws_api_gateway_method.webhook_post.http_method}${aws_api_gateway_resource.webhook.path}"
}

data "aws_iam_policy_document" "assume_role_lambda" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name = "${local.app}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.assume_role_lambda.json
}

data "aws_iam_policy_document" "lambda" {
  statement {
    actions = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:*"]
  }
}

resource "aws_iam_role_policy" "lambda" {
  name = "${local.app}-lambda-policy"
  role = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_cloudwatch_log_group" "logs" {
  name = "/aws/lambda/${aws_lambda_function.webhook.function_name}"
  retention_in_days = 1
  tags = {
    Terraform = local.app
  }
}

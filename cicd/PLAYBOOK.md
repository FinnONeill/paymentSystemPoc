## Developer Playbook – CI/CD Terraform Modules

This playbook explains **how application developers should use the Terraform modules** in the `cicd/terraform` directory to add new Lambdas, schedules, APIs, and messaging, while keeping the infrastructure **secure, consistent, and reviewable**.

### What you CAN safely change

- **Environment configs** under `cicd/terraform/environments/`:
  - Add or update **module blocks** (e.g. new Lambda, schedule, SNS topic, API).
  - Add or update **variable values** (e.g. names, tags, schedule expressions).
  - Add **outputs** that you need for application wiring (ARNs, URLs, topic names).
- **Module inputs only**:
  - You can extend modules by **adding variables and wiring them into resources** if you coordinate with the platform/infra owner.

### What you SHOULD NOT change directly

- **Provider and backend configuration** (Terraform `terraform` and `provider` blocks) unless agreed with the platform/infra owner.
- **Core module logic** in:
  - `cicd/terraform/modules/kafka-mks`
  - `cicd/terraform/modules/glue-schema-registry`
  - `cicd/terraform/modules/eventbridge-schedules`
  - `cicd/terraform/modules/lambda-with-triggers`
  - `cicd/terraform/modules/lambda-basic`
  - `cicd/terraform/modules/sns-topics`
  - `cicd/terraform/modules/iam-roles`
  - `cicd/terraform/modules/api-gateway-http`
- **IAM policies with wildcards**:
  - Do not add `Action = "*"` or `Resource = "*"` unless it has been approved and documented by security/infra.
- **Any hard-coded credentials or secrets**:
  - Never put passwords, keys, tokens, or connection strings into Terraform code or variables files.

If you need a new capability from a module (e.g. extra Lambda permissions), request a **small, reviewed change** to the module instead of copying and editing it ad hoc.

---

## Adding a new Lambda

For most use cases, use one of:

- `lambda-with-triggers` – Lambda that runs on a **schedule** or other event sources.
- `lambda-basic` – Lambda that is triggered by **API Gateway**, SNS, SQS, or other integrations.

### 1. Decide on the triggering mechanism

1. **Scheduled/background processing** → use `lambda-with-triggers` alongside `eventbridge-schedules`.
2. **HTTP API endpoint** → use `lambda-basic` with `api-gateway-http`.
3. **Messaging (SNS/SQS)** → use `lambda-basic`, then configure the subscription/integration.

If you are unsure which to use, talk to the infra/platform owner.

### 2. Create or update an environment file

In your target environment folder (e.g. `cicd/terraform/environments/dev`):

1. **Add input variables** if needed (e.g. `lambda_kms_key_arn`, tags).
2. **Add the Lambda module block**, for example:

```hcl
module "my_feature_lambda" {
  source            = "../../modules/lambda-basic"
  lambda_name       = "${var.project_name}-${var.environment}-my-feature"
  description       = "Processes MyFeature events."
  runtime           = "nodejs20.x"
  handler           = "index.handler"
  memory_size_mb    = 512
  timeout_seconds   = 60
  vpc_id            = var.vpc_id
  subnet_ids        = var.private_subnet_ids
  security_group_ids = var.lambda_security_group_ids
  environment_variables = {
    FEATURE_FLAG = "enabled"
  }
  source_zip_path               = var.lambda_source_zip_path
  environment_kms_key_arn       = var.lambda_kms_key_arn
  attach_cloudwatch_logs_policy = true
  tags                          = local.common_tags
}
```

3. **Update your application code** to match the handler (e.g. `index.handler`) and package it according to your CI build pipeline (typically as a ZIP artifact). Both `lambda-basic` and `lambda-with-triggers` require **`source_zip_path`** — the path to your Lambda deployment ZIP (e.g. from your build output or CI artifact). Set this via a variable (e.g. `var.lambda_source_zip_path`) so CI can pass the built artifact path.

You should not change the `lambda-basic` module internals unless coordinated with infra.

---

## Adding a new EventBridge schedule

Use the `eventbridge-schedules` module to manage schedules in a **single, typed list**. **EventBridge Scheduler requires a valid IAM role ARN** (`target_role`) to invoke Lambda targets; you cannot pass `null`. Create an IAM role that `scheduler.amazonaws.com` can assume, with a policy allowing `lambda:InvokeFunction` on the target Lambda, and pass that role's ARN.

1. In your environment file (e.g. `main.tf`):
   - Ensure an IAM role exists for the scheduler (e.g. like `aws_iam_role.eventbridge_scheduler` in the example environment) that can invoke your Lambda.
   - Find the `module "eventbridge_schedules"` block and add a new entry to the `schedules` list, for example:

```hcl
module "eventbridge_schedules" {
  source = "../../modules/eventbridge-schedules"

  schedules = [
    {
      name                = "${var.project_name}-${var.environment}-nightly-job"
      description         = "Runs the nightly data job."
      schedule_expression = "cron(0 2 * * ? *)" # 2am UTC
      flexible_time_window = {
        mode                      = "OFF"
        maximum_window_in_minutes = null
      }
      target_arn  = module.my_feature_lambda.lambda_arn
      target_role = aws_iam_role.eventbridge_scheduler.arn
      input       = jsonencode({ job = "nightly" })
    }
  ]

  tags = local.common_tags
}
```

2. Keep the structure of the `schedules` variable consistent and avoid changing the resource type or state unless you understand the lifecycle implications.

---

## Adding an SNS topic

Use the `sns-topics` module to define **one or more topics**.

1. In your environment file:

```hcl
module "sns_topics" {
  source = "../../modules/sns-topics"

  topics = [
    {
      name         = "${var.project_name}-${var.environment}-events"
      display_name = "NachaLayer Events"
    }
  ]

  tags = local.common_tags
}
```

2. Use the exported topic ARNs from this module in other modules (e.g. subscriptions, Lambda triggers, or application configuration).

---

## Adding an API Gateway + Lambda

Use `api-gateway-http` with `lambda-basic`:

1. Define your Lambda using `lambda-basic`.
2. Add the API module and pass the Lambda ARN as the integration target:

```hcl
module "api_gateway" {
  source = "../../modules/api-gateway-http"

  api_name        = "${var.project_name}-${var.environment}-http-api"
  stage_name      = var.environment
  lambda_arn      = module.my_feature_lambda.lambda_arn
  lambda_invoke_role_arn = module.iam_api_invoke_role.role_arn

  tags = local.common_tags
}
```

3. For IAM, prefer using the `iam-roles` module to create specific roles for API → Lambda invocation instead of embedding IAM directly.

---

## IAM roles and permissions

- Use the `iam-roles` module to create **purpose-specific roles** (e.g. `api_invoke_role`, `data_job_role`).
- Keep policies:
  - **Scoped** to the minimum required AWS services and resources.
  - **Documented** with clear descriptions.
  - **Reviewable** by infra/security.

Avoid copying existing policies blindly. If you need broader access, discuss requirements with infra/security first.

---

## Quality and security checklist

Before you raise a PR:

- **No secrets** in Terraform or `*.tfvars` committed to the repo.
- **Least privilege IAM**:
  - No `Action="*"` or `Resource="*"` unless reviewed and justified.
- **Encryption**:
  - MSK, Glue, and Lambda environment variables use encryption (KMS or service-managed).
- **Naming and tagging**:
  - Use `project_name` and `environment` in resource names.
  - Include `ManagedBy = "terraform"` tag by default.
- **Review and testing**:
  - Run `terraform fmt`, `terraform validate`, and `terraform plan`.
  - Ensure plans are reviewed by someone familiar with the AWS account before applying.

Following this playbook helps keep the infrastructure **secure, maintainable, and SonarQube‑friendly** while allowing developers to move quickly.


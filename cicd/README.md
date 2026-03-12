## CI/CD Infrastructure as Code

This `cicd` folder contains **Terraform examples** for deploying and managing the core infrastructure used by this project:

- **Kafka (AWS MSK)**
- **AWS Glue Schema Registry**
- **EventBridge schedules**
- **AWS Lambda functions with triggers**

These are **examples only** and are designed to be:

- **Modular**: Each concern is implemented as a separate Terraform module.
- **Secure by default**: Encryption enabled, least-privilege IAM, no hard-coded secrets.
- **Environment‑agnostic**: Configuration is driven by variables rather than inline values.
- **SonarQube‑friendly**: Avoids common issues like duplicated code, dead code, hard-coded credentials, and overly permissive access.

> Important: These examples intentionally omit any real account IDs, secrets, or VPC IDs. You must parameterize those via variables, remote state, or a secure configuration mechanism before real use.

### Layout

- `terraform/environments/example/main.tf` – Example composition of all modules.
- `terraform/modules/kafka-mks` – Example AWS MSK cluster and topic configuration.
- `terraform/modules/glue-schema-registry` – Example Glue Schema Registry and schema.
- `terraform/modules/eventbridge-schedules` – Example EventBridge Scheduler schedules.
- `terraform/modules/lambda-with-triggers` – Example Lambda and event-based triggers.

### Security and best practices

- **No credentials in code**: Use environment variables, AWS SSO, or IAM roles for authentication.
- **Encryption**:
  - MSK broker and data‑at‑rest encryption enabled.
  - Glue registry resources use service-managed encryption (optionally customer‑managed KMS).
  - Lambda environment variables can be encrypted with KMS.
- **IAM**:
  - Policies are scoped to the minimum set of actions needed.
  - Avoid wildcard principals (`"*"`), prefer role and principal ARNs.
- **Networking**:
  - MSK is deployed into private subnets.
  - Security groups restrict ingress to known producer/consumer security groups.

### Using the example

1. Install Terraform (`>= 1.5.0`).
2. Copy `terraform/environments/example` to a new folder for your environment (e.g. `dev`).
3. Review and update variable values (VPC, subnet IDs, KMS keys, ARNs, etc.).
4. Run:

```bash
terraform init
terraform plan
terraform apply
```

Do not run `terraform apply` against a production account until the configuration has been **reviewed by your team’s cloud/security engineers**.


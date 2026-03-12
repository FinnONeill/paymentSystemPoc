variable "roles" {
  description = <<EOF
List of IAM roles to create. Each object supports:
- name        : Name of the role.
- description : Optional description.
- assume_role_policy_json : JSON string for the trust policy.
- inline_policies : Optional list of inline policies with name and policy JSON.
EOF
  type = list(object({
    name                    = string
    description             = optional(string, "")
    assume_role_policy_json = string
    inline_policies = optional(list(object({
      name   = string
      policy = string
    })), [])
  }))
}

variable "tags" {
  description = "Common tags to apply to resources."
  type        = map(string)
  default     = {}
}

locals {
  inline_role_policies = flatten([
    for role_def in var.roles : [
      for policy_def in (try(role_def.inline_policies, [])) : {
        role_name = role_def.name
        name      = policy_def.name
        policy    = policy_def.policy
      }
    ]
  ])
}

resource "aws_iam_role" "this" {
  for_each = { for r in var.roles : r.name => r }

  name        = each.value.name
  description = each.value.description != "" ? each.value.description : null

  assume_role_policy = each.value.assume_role_policy_json

  tags = var.tags
}

resource "aws_iam_role_policy" "inline" {
  for_each = { for rp in local.inline_role_policies : "${rp.role_name}:${rp.name}" => rp }

  role   = aws_iam_role.this[each.value.role_name].id
  name   = each.value.name
  policy = each.value.policy
}

output "role_arns" {
  description = "Map of role names to ARNs."
  value       = { for name, role in aws_iam_role.this : name => role.arn }
}


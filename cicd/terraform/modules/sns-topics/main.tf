variable "topics" {
  description = <<EOF
List of SNS topics to create. Each object supports:
- name         : Name of the topic.
- display_name : Optional human-friendly display name.
EOF
  type = list(object({
    name         = string
    display_name = optional(string, "")
  }))

  validation {
    condition     = length(var.topics) == length(distinct([for t in var.topics : t.name]))
    error_message = "Duplicate topic names are not allowed. Each topic must have a unique 'name'. Check the 'name' field of each topic."
  }
}

variable "tags" {
  description = "Common tags to apply to resources."
  type        = map(string)
  default     = {}
}

resource "aws_sns_topic" "this" {
  for_each = { for t in var.topics : t.name => t }

  name         = each.value.name
  display_name = each.value.display_name != "" ? each.value.display_name : null

  kms_master_key_id = null

  tags = var.tags
}

output "topic_arns" {
  description = "Map of topic names to ARNs."
  value       = { for k, v in aws_sns_topic.this : k => v.arn }
}


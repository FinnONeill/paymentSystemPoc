variable "schedules" {
  description = <<EOF
List of schedules to create. Each object supports:
- name                : Name of the schedule.
- description         : Optional description.
- schedule_expression : Expression in rate() or cron() format.
- flexible_time_window: Object with 'mode' (OFF or FLEXIBLE) and optional 'maximum_window_in_minutes'.
- target_arn          : ARN of the target (e.g. Lambda function).
- target_role         : IAM role ARN used by EventBridge Scheduler to invoke the target (required for Lambda).
- input               : Optional JSON input string delivered to the target.
EOF
  type = list(object({
    name                = string
    description         = optional(string, "")
    schedule_expression = string
    flexible_time_window = object({
      mode                      = string
      maximum_window_in_minutes = optional(number)
    })
    target_arn  = string
    target_role = string
    input       = optional(string, "")
  }))

  validation {
    condition     = length(var.schedules) == length(distinct([for s in var.schedules : s.name]))
    error_message = "Duplicate schedule names are not allowed. Each schedule must have a unique 'name'. Check the 'name' field of each schedule."
  }
}

variable "tags" {
  description = "Common tags to apply to resources."
  type        = map(string)
  default     = {}
}

resource "aws_scheduler_schedule" "this" {
  for_each = { for s in var.schedules : s.name => s }

  name        = each.value.name
  description = each.value.description != "" ? each.value.description : null

  schedule_expression = each.value.schedule_expression

  flexible_time_window {
    mode = each.value.flexible_time_window.mode

    maximum_window_in_minutes = each.value.flexible_time_window.maximum_window_in_minutes
  }

  target {
    arn      = each.value.target_arn
    role_arn = each.value.target_role
    input    = try(each.value.input, "") != "" ? each.value.input : null
  }

  state = "ENABLED"
}

output "schedule_names" {
  description = "Names of the created schedules."
  value       = [for s in aws_scheduler_schedule.this : s.name]
}


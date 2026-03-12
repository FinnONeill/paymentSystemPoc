variable "registry_name" {
  description = "Name for the Glue Schema Registry."
  type        = string
}

variable "description" {
  description = "Description of the registry."
  type        = string
  default     = ""
}

variable "schemas" {
  description = <<EOF
Map of schemas to create in the registry.
Key is an arbitrary identifier; each value supports:
- schema_name   : Name of the schema in Glue.
- compatibility : Compatibility mode (e.g. BACKWARD, FORWARD, FULL).
- definition    : Avro schema definition as a JSON string.
- data_format   : Optional data format (defaults to AVRO).
EOF
  type = map(object({
    schema_name   = string
    compatibility = string
    definition    = string
    data_format   = optional(string, "AVRO")
  }))
  default = {}
}

variable "tags" {
  description = "Common tags to apply to resources."
  type        = map(string)
  default     = {}
}

resource "aws_glue_registry" "this" {
  registry_name = var.registry_name
  description   = var.description != "" ? var.description : null

  tags = var.tags
}

resource "aws_glue_schema" "this" {
  for_each = var.schemas

  schema_name       = each.value.schema_name
  registry_arn      = aws_glue_registry.this.arn
  data_format       = each.value.data_format
  compatibility     = each.value.compatibility
  schema_definition = each.value.definition
}

output "registry_arn" {
  description = "ARN of the Glue Schema Registry."
  value       = aws_glue_registry.this.arn
}

output "schema_arns" {
  description = "Map of schema identifiers to ARNs."
  value       = { for key, schema in aws_glue_schema.this : key => schema.arn }
}


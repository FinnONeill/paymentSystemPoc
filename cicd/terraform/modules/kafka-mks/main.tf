variable "cluster_name" {
  description = "Name for the MSK cluster."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the MSK cluster will be created."
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the MSK brokers (private subnets recommended)."
  type        = list(string)
}

variable "allowed_client_sg_ids" {
  description = "Security group IDs that are allowed to connect to the brokers."
  type        = list(string)
}

variable "broker_instance_type" {
  description = "Instance type for MSK brokers."
  type        = string
}

variable "broker_volume_size_gib" {
  description = "EBS volume size in GiB for each broker."
  type        = number
}

variable "number_of_broker_nodes" {
  description = "Number of broker nodes."
  type        = number
}

variable "encryption_kms_key_arn" {
  description = "Optional KMS key ARN for encrypting MSK data at rest. If null, AWS owned key is used."
  type        = string
  default     = null
}

variable "enhanced_monitoring_level" {
  description = "MSK enhanced monitoring level (e.g. DEFAULT, PER_BROKER, PER_TOPIC_PER_BROKER)."
  type        = string
  default     = "DEFAULT"
}

variable "tags" {
  description = "Common tags to apply to resources."
  type        = map(string)
  default     = {}
}

resource "aws_security_group" "msk_brokers" {
  name        = "${var.cluster_name}-sg"
  description = "Security group for MSK brokers."
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound traffic for brokers."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.cluster_name}-sg" })
}

resource "aws_security_group_rule" "msk_client_ingress" {
  for_each = toset(var.allowed_client_sg_ids)

  type                     = "ingress"
  description              = "Allow Kafka clients to connect to brokers over TLS."
  from_port                = 9094
  to_port                  = 9094
  protocol                 = "tcp"
  security_group_id        = aws_security_group.msk_brokers.id
  source_security_group_id = each.value
}

resource "aws_msk_cluster" "this" {
  cluster_name           = var.cluster_name
  kafka_version          = "3.6.0"
  number_of_broker_nodes = var.number_of_broker_nodes

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.subnet_ids
    security_groups = [aws_security_group.msk_brokers.id]

    storage_info {
      ebs_storage_info {
        volume_size = var.broker_volume_size_gib
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = var.encryption_kms_key_arn
  }

  enhanced_monitoring = var.enhanced_monitoring_level

  tags = var.tags
}

output "bootstrap_brokers_tls" {
  description = "TLS bootstrap broker connection string."
  value       = aws_msk_cluster.this.bootstrap_brokers_tls
}

output "security_group_id" {
  description = "Security group ID for the MSK brokers."
  value       = aws_security_group.msk_brokers.id
}


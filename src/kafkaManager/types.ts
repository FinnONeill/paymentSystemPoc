export interface GlueSchemaRegistryConfig {
  readonly region: string;
  readonly registryName: string;
  readonly schemaName: string;
}

export interface KafkaConnectionConfig {
  readonly clientId: string;
  readonly brokers: readonly string[];
  readonly ssl?: boolean;
  readonly sasl?:
    | {
        readonly mechanism: 'plain';
        readonly username: string;
        readonly password: string;
      }
    | {
        readonly mechanism: 'scram-sha-512' | 'scram-sha-256';
        readonly username: string;
        readonly password: string;
      }
    | {
        readonly mechanism: 'aws';
        readonly authorizationIdentity?: string;
      };
}

export interface KafkaTopicConfig {
  readonly topic: string;
  readonly numPartitions?: number;
  readonly replicationFactor?: number;
}

export interface AvroSchemaDefinitionField {
  name: string;
  // Using `any` here keeps the schema type flexible while remaining compatible
  // with the `avsc` library's `Schema` type expectations.
  type: any;
}

export interface AvroSchemaDefinition {
  type: 'record';
  name: string;
  namespace?: string;
  fields: AvroSchemaDefinitionField[];
}

export interface SchemaValidationResult {
  readonly isCompatible: boolean;
  readonly schemaArn: string;
  readonly versionId: string;
}

export interface SerializationContext<TPayload> {
  readonly payload: TPayload;
  readonly schema: AvroSchemaDefinition;
}

export interface DeserializationContext<TPayload> {
  readonly buffer: Buffer;
  readonly schema: AvroSchemaDefinition;
}

export interface KafkaProducerRecord<TPayload> {
  readonly topic: string;
  readonly key?: string;
  readonly value: TPayload;
  readonly headers?: Record<string, string>;
}

export interface KafkaConsumerMessage<TPayload> {
  readonly topic: string;
  readonly partition: number;
  readonly offset: string;
  readonly key: string | null;
  readonly value: TPayload;
  readonly headers: Record<string, string>;
}

export interface KafkaManagerOptions {
  readonly connection: KafkaConnectionConfig;
  readonly topicConfig: KafkaTopicConfig;
  readonly glueConfig: GlueSchemaRegistryConfig;
}


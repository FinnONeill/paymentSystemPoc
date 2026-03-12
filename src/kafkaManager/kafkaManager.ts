import { Kafka, logLevel, Partitioners } from 'kafkajs';
import { AvroSerializer } from './serializer';
import {
  AvroSchemaDefinition,
  KafkaConsumerMessage,
  KafkaManagerOptions,
  KafkaProducerRecord,
} from './types';
import { GlueSchemaRegistry } from './schemaRegistry';

export class KafkaManager<TPayload extends Record<string, unknown>> {
  private readonly options: KafkaManagerOptions;
  private readonly registry: GlueSchemaRegistry;
  private readonly serializer: AvroSerializer<TPayload>;
  private readonly kafka: Kafka;
  private readonly schema: AvroSchemaDefinition;

  constructor(options: KafkaManagerOptions, schema: AvroSchemaDefinition) {
    this.options = options;
    this.schema = schema;
    this.registry = new GlueSchemaRegistry(options.glueConfig);
    this.serializer = new AvroSerializer<TPayload>(schema);
    this.kafka = new Kafka({
      clientId: options.connection.clientId,
      brokers: [...options.connection.brokers],
      ssl: options.connection.ssl,
      sasl: options.connection.sasl as never,
      logLevel: logLevel.NOTHING,
    });
  }

  get defaultTopic(): string {
    return this.options.topicConfig.topic;
  }

  async ensureSchemaCompatibility(): Promise<void> {
    await this.registry.validateOrRegisterSchema(this.schema);
  }

  async produce(record: KafkaProducerRecord<TPayload>): Promise<void> {
    await this.ensureSchemaCompatibility();
    const producer = this.kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
    });
    await producer.connect();

    try {
      const buffer = this.serializer.serialize({
        payload: record.value,
        schema: this.schema,
      });

      await producer.send({
        topic: record.topic,
        messages: [
          {
            key: record.key,
            value: buffer,
            headers: record.headers,
          },
        ],
      });
    } finally {
      await producer.disconnect();
    }
  }

  async consume(
    groupId: string,
    handler: (message: KafkaConsumerMessage<TPayload>) => Promise<void>,
  ): Promise<void> {
    await this.ensureSchemaCompatibility();

    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic: this.options.topicConfig.topic, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          return;
        }

        const value = this.serializer.deserialize({
          buffer: message.value,
          schema: this.schema,
        });

        const headers: Record<string, string> = {};
        if (message.headers) {
          for (const [key, headerValue] of Object.entries(message.headers)) {
            if (typeof headerValue === 'string') {
              headers[key] = headerValue;
            } else if (Buffer.isBuffer(headerValue)) {
              headers[key] = headerValue.toString('utf8');
            }
          }
        }

        await handler({
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString() ?? null,
          value,
          headers,
        });
      },
    });
  }
}


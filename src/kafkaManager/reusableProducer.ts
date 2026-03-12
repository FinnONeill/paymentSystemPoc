import { Kafka, logLevel, Partitioners } from 'kafkajs';
import { AvroSerializer } from './serializer';
import {
  AvroSchemaDefinition,
  KafkaManagerOptions,
  KafkaProducerRecord,
} from './types';
import { GlueSchemaRegistry } from './schemaRegistry';

export class ReusableKafkaProducer<TPayload extends Record<string, unknown>> {
  private readonly options: KafkaManagerOptions;
  private readonly registry: GlueSchemaRegistry;
  private readonly serializer: AvroSerializer<TPayload>;
  private readonly kafka: Kafka;
  private readonly schema: AvroSchemaDefinition;
  private producer:
    | ReturnType<Kafka['producer']>
    | undefined;
  private initialized = false;
  private initializingPromise: Promise<void> | null = null;

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

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializingPromise !== null) {
      await this.initializingPromise;
      return;
    }

    const initPromise: Promise<void> = (async () => {
      try {
        await this.registry.validateOrRegisterSchema(this.schema);

        const producer = this.kafka.producer({
          createPartitioner: Partitioners.DefaultPartitioner,
        });
        await producer.connect();
        this.producer = producer;
        this.initialized = true;
      } finally {
        this.initializingPromise = null;
      }
    })();

    this.initializingPromise = initPromise;
    await initPromise;
  }

  async produce(record: KafkaProducerRecord<TPayload>): Promise<void> {
    await this.init();

    if (!this.producer) {
      throw new Error('Kafka producer is not initialized.');
    }

    const buffer = this.serializer.serialize({
      payload: record.value,
      schema: this.schema,
    });

    await this.producer.send({
      topic: record.topic,
      messages: [
        {
          key: record.key,
          value: buffer,
          headers: record.headers,
        },
      ],
    });
  }

  async disconnect(): Promise<void> {
    if (!this.producer) {
      return;
    }

    await this.producer.disconnect();
    this.producer = undefined;
    this.initialized = false;
    this.initializingPromise = null;
  }
}


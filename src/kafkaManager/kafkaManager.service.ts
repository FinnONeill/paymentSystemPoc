import { Injectable } from '@nestjs/common';
import { KafkaManager } from './kafkaManager';
import { AvroSchemaDefinition, KafkaManagerOptions } from './types';

interface TestEventPayload extends Record<string, unknown> {
  readonly id: string;
}

const testEventSchema: AvroSchemaDefinition = {
  type: 'record',
  name: 'TestEvent',
  fields: [
    {
      name: 'id',
      type: 'string',
    },
  ],
};

function parseBrokers(envValue: string | undefined): string[] {
  if (!envValue) {
    return ['localhost:9092'];
  }
  return envValue
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);
}

@Injectable()
export class KafkaManagerService {
  private readonly manager: KafkaManager<TestEventPayload>;

  constructor() {
    const options: KafkaManagerOptions = {
      connection: {
        clientId: process.env.KAFKA_CLIENT_ID ?? 'nacha-layer-kafka-client',
        brokers: parseBrokers(process.env.KAFKA_BROKERS),
        ssl: process.env.KAFKA_SSL === 'true',
      },
      topicConfig: {
        topic: process.env.KAFKA_TEST_TOPIC ?? 'nacha-layer-test-topic',
      },
      glueConfig: {
        region: process.env.GLUE_REGION ?? 'eu-west-1',
        registryName: process.env.GLUE_REGISTRY_NAME ?? 'nacha-layer-registry',
        schemaName: process.env.GLUE_SCHEMA_NAME ?? 'nacha-layer-test-schema',
      },
    };

    this.manager = new KafkaManager<TestEventPayload>(options, testEventSchema);
  }

  async produceTestEvent(id: string): Promise<void> {
    if (!id) {
      throw new Error('id must be a non-empty string');
    }

    await this.manager.produce({
      topic: this.manager['options'].topicConfig.topic,
      value: { id },
    });
  }

  async validateSchema(): Promise<void> {
    await this.manager.ensureSchemaCompatibility();
  }
}


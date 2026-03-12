import { KafkaManager } from './kafkaManager';
import { AvroSchemaDefinition, KafkaManagerOptions } from './types';

jest.mock('kafkajs', () => {
  let capturedBuffer: Buffer | undefined;

  const producerMock = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockImplementation(async ({ messages }) => {
      const [message] = messages ?? [];
      if (message && message.value instanceof Buffer) {
        capturedBuffer = message.value;
      }
      return undefined;
    }),
  };

  const consumerMock = {
    connect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockImplementation(async ({ eachMessage }) => {
      // First message has no value and should be ignored.
      await eachMessage({
        topic: 'test-topic',
        partition: 0,
        message: {
          offset: '0',
          key: Buffer.from('key-0'),
          value: undefined,
          headers: undefined,
        },
      });

      // Second message has a payload and mixed header types.
      await eachMessage({
        topic: 'test-topic',
        partition: 1,
        message: {
          offset: '1',
          key: Buffer.from('key-1'),
          value: capturedBuffer ?? Buffer.from(JSON.stringify({ id: '123' })),
          headers: {
            'x-string': 'value',
            'x-buffer': Buffer.from('buffer-value'),
          },
        },
      });

      // Third message has a payload but no headers to exercise the
      // "no headers" branch in the consumer logic.
      await eachMessage({
        topic: 'test-topic',
        partition: 2,
        message: {
          offset: '2',
          key: Buffer.from('key-2'),
          value: capturedBuffer ?? Buffer.from(JSON.stringify({ id: '456' })),
          headers: undefined,
        },
      });

      return undefined;
    }),
  };

  return {
    Kafka: jest.fn().mockImplementation(() => ({
      producer: () => producerMock,
      consumer: () => consumerMock,
    })),
    logLevel: { NOTHING: 0 },
    Partitioners: { DefaultPartitioner: jest.fn() },
  };
});

jest.mock('@aws-sdk/client-glue', () => {
  const validateResponse = {
    SchemaVersionId: 'test-version',
    SchemaArn: 'arn:aws:glue:region:account:schema/test',
    Status: 'AVAILABLE',
  };

  const sendMock = jest.fn().mockImplementation(() => {
    const callIndex = sendMock.mock.calls.length;
    if (callIndex % 2 === 1) {
      return Promise.resolve(validateResponse);
    }
    return Promise.resolve({ SchemaDefinition: JSON.stringify(testSchema) });
  });

  return {
    GlueClient: jest.fn().mockImplementation(() => ({
      send: sendMock,
    })),
    GetSchemaVersionCommand: jest.fn(),
    RegisterSchemaVersionCommand: jest.fn(),
    SchemaVersionStatus: {
      AVAILABLE: 'AVAILABLE',
      COMPLETE: 'COMPLETE',
    },
  };
});

const testSchema: AvroSchemaDefinition = {
  type: 'record',
  name: 'TestRecord',
  fields: [
    {
      name: 'id',
      type: 'string',
    },
  ],
};

interface TestPayload extends Record<string, unknown> {
  id: string;
}

const options: KafkaManagerOptions = {
  connection: {
    clientId: 'test-client',
    brokers: ['localhost:9092'],
  },
  topicConfig: {
    topic: 'test-topic',
  },
  glueConfig: {
    region: 'eu-west-1',
    registryName: 'test-registry',
    schemaName: 'test-schema',
  },
};

describe('KafkaManager', () => {
  it('produces messages after schema validation', async () => {
    const manager = new KafkaManager<TestPayload>(options, testSchema);

    await expect(
      manager.produce({
        topic: 'test-topic',
        value: { id: '123' },
      }),
    ).resolves.toBeUndefined();
  });

  it('consumes messages and invokes handler', async () => {
    const manager = new KafkaManager<TestPayload>(options, testSchema);
    const handler = jest.fn().mockResolvedValue(undefined);

    // Ensure we have a serialized buffer captured for the consumer side.
    await manager.produce({
      topic: 'test-topic',
      value: { id: '123' },
    });

    await manager.consume('test-group', handler);

    expect(handler).toHaveBeenCalledTimes(2);

    const [firstMessage] = handler.mock.calls[0] ?? [];
    expect(firstMessage).toMatchObject({
      topic: 'test-topic',
      partition: 1,
      offset: '1',
      key: 'key-1',
      value: { id: '123' },
      headers: {
        'x-string': 'value',
        'x-buffer': 'buffer-value',
      },
    });

    const [secondMessage] = handler.mock.calls[1] ?? [];
    expect(secondMessage).toMatchObject({
      topic: 'test-topic',
      partition: 2,
      offset: '2',
      key: 'key-2',
      value: { id: '123' },
      headers: {},
    });
  });
});


import { ReusableKafkaProducer } from './reusableProducer';
import { AvroSchemaDefinition, KafkaManagerOptions } from './types';

jest.mock('kafkajs', () => {
  const connect = jest.fn().mockResolvedValue(undefined);
  const disconnect = jest.fn().mockResolvedValue(undefined);
  const send = jest.fn().mockResolvedValue(undefined);

  const producerMock = {
    connect,
    disconnect,
    send,
  };

  return {
    Kafka: jest.fn().mockImplementation(() => ({
      producer: () => producerMock,
    })),
    logLevel: { NOTHING: 0 },
    Partitioners: { DefaultPartitioner: jest.fn() },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
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

jest.mock('@aws-sdk/client-glue', () => {
  const registrationResponse = {
    SchemaVersionId: 'version-1',
    SchemaArn: 'arn:aws:glue:region:account:schema/test',
    Status: 'AVAILABLE',
  };

  const sendMock = jest.fn().mockImplementation(() => {
    const callIndex = sendMock.mock.calls.length;

    // Odd calls: register schema, even calls: fetch schema definition.
    if (callIndex % 2 === 1) {
      return Promise.resolve(registrationResponse);
    }

    return Promise.resolve({
      SchemaDefinition: JSON.stringify(testSchema),
    });
  });

  return {
    GlueClient: jest.fn().mockImplementation(() => ({
      send: sendMock,
    })),
    GetSchemaVersionCommand: jest.fn(),
    RegisterSchemaVersionCommand: jest.fn(),
    SchemaVersionStatus: {
      AVAILABLE: 'AVAILABLE',
    },
  };
});

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

describe('ReusableKafkaProducer', () => {
  it('initializes only once and reuses the connection', async () => {
    const producer = new ReusableKafkaProducer<TestPayload>(options, testSchema);

    await producer.init();
    await producer.init();

    // The underlying kafkajs producer should have been connected exactly once.
    const { Kafka } = jest.requireMock('kafkajs') as {
      Kafka: jest.Mock;
    };
    const instance = Kafka.mock.results[0]?.value;
    const producerInstance = instance.producer();

    expect(producerInstance.connect).toHaveBeenCalledTimes(1);
  });

  it('produces multiple messages using a single producer instance', async () => {
    const producer = new ReusableKafkaProducer<TestPayload>(options, testSchema);

    await producer.produce({
      topic: 'test-topic',
      value: { id: '1' },
    });

    await producer.produce({
      topic: 'test-topic',
      value: { id: '2' },
    });

    const { Kafka } = jest.requireMock('kafkajs') as {
      Kafka: jest.Mock;
    };
    const instance = Kafka.mock.results[0]?.value;
    const producerInstance = instance.producer();

    expect(producerInstance.connect).toHaveBeenCalledTimes(1);
    expect(producerInstance.send).toHaveBeenCalledTimes(2);
  });

  it('disconnects gracefully when a producer exists', async () => {
    const producer = new ReusableKafkaProducer<TestPayload>(options, testSchema);

    await producer.produce({
      topic: 'test-topic',
      value: { id: '1' },
    });

    const { Kafka } = jest.requireMock('kafkajs') as {
      Kafka: jest.Mock;
    };
    const instance = Kafka.mock.results[0]?.value;
    const producerInstance = instance.producer();

    await producer.disconnect();

    expect(producerInstance.disconnect).toHaveBeenCalledTimes(1);
  });

  it('is a no-op to disconnect when no producer has been initialized', async () => {
    const producer = new ReusableKafkaProducer<TestPayload>(options, testSchema);

    await expect(producer.disconnect()).resolves.toBeUndefined();
  });
});


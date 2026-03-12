import { Test, TestingModule } from '@nestjs/testing';
import { KafkaManagerService } from './kafkaManager.service';
import { KafkaManager } from './kafkaManager';

jest.mock('./kafkaManager');

describe('KafkaManagerService', () => {
  let service: KafkaManagerService;
  const produceMock = jest.fn().mockResolvedValue(undefined);
  const ensureSchemaCompatibilityMock = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    (KafkaManager as unknown as jest.Mock).mockImplementation(() => ({
      produce: produceMock,
      ensureSchemaCompatibility: ensureSchemaCompatibilityMock,
      options: {
        topicConfig: {
          topic: 'test-topic',
        },
      },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [KafkaManagerService],
    }).compile();

    service = module.get(KafkaManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('constructs KafkaManager with default broker when env is unset', async () => {
    delete process.env.KAFKA_BROKERS;

    const module: TestingModule = await Test.createTestingModule({
      providers: [KafkaManagerService],
    }).compile();

    const localService = module.get(KafkaManagerService);
    await localService.validateSchema();

    expect(KafkaManager).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: expect.objectContaining({
          brokers: ['localhost:9092'],
        }),
      }),
      expect.any(Object),
    );
  });

  it('parses brokers from environment, trimming and filtering empties', async () => {
    process.env.KAFKA_BROKERS = '  broker-1:9092 , , broker-2:9092 , ';

    const module: TestingModule = await Test.createTestingModule({
      providers: [KafkaManagerService],
    }).compile();

    const localService = module.get(KafkaManagerService);
    await localService.validateSchema();

    expect(KafkaManager).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: expect.objectContaining({
          brokers: ['broker-1:9092', 'broker-2:9092'],
        }),
      }),
      expect.any(Object),
    );
  });

  it('validates schema via manager', async () => {
    await service.validateSchema();
    expect(ensureSchemaCompatibilityMock).toHaveBeenCalledTimes(1);
  });

  it('produces a test event with a valid id', async () => {
    await service.produceTestEvent('abc-123');

    expect(produceMock).toHaveBeenCalledTimes(1);
    const [record] = produceMock.mock.calls[0] ?? [];
    expect(record).toMatchObject({
      topic: 'test-topic',
      value: { id: 'abc-123' },
    });
  });

  it('throws when id is empty', async () => {
    await expect(service.produceTestEvent('')).rejects.toThrow(
      /id must be a non-empty string/,
    );
    expect(produceMock).not.toHaveBeenCalled();
  });
});


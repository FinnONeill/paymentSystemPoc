import { Test, TestingModule } from '@nestjs/testing';
import { KafkaManagerController } from './kafkaManager.controller';
import { KafkaManagerService } from './kafkaManager.service';

describe('KafkaManagerController', () => {
  let controller: KafkaManagerController;
  let service: KafkaManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KafkaManagerController],
      providers: [
        {
          provide: KafkaManagerService,
          useValue: {
            validateSchema: jest.fn().mockResolvedValue(undefined),
            produceTestEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get(KafkaManagerController);
    service = module.get(KafkaManagerService);
  });

  it('returns { valid: true } after schema validation', async () => {
    const result = await controller.validateSchema();
    expect(result).toEqual({ valid: true });
    expect(service.validateSchema).toHaveBeenCalledTimes(1);
  });

  it('queues a test event and echoes id', async () => {
    const body = { id: 'event-1' };

    const result = await controller.produceTestEvent(body);

    expect(result).toEqual({ status: 'queued', id: 'event-1' });
    expect(service.produceTestEvent).toHaveBeenCalledWith('event-1');
  });
});


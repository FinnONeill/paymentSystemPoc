import { Test, TestingModule } from '@nestjs/testing';
import { KafkaManagerModule } from './kafkaManager.module';

describe('KafkaManagerModule', () => {
  it('initializes the KafkaManagerModule', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [KafkaManagerModule],
    }).compile();

    const compiled = module.get(KafkaManagerModule);
    expect(compiled).toBeInstanceOf(KafkaManagerModule);
  });
});


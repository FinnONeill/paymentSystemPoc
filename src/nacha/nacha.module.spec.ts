import { Test, TestingModule } from '@nestjs/testing';
import { NachaModule } from './nacha.module';

describe('NachaModule', () => {
  it('initializes the NachaModule', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [NachaModule],
    }).compile();

    const compiled = module.get(NachaModule);
    expect(compiled).toBeInstanceOf(NachaModule);
  });
});


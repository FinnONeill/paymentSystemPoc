import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { NachaController } from './nacha.controller';
import { NachaService } from './nacha.service';
import type { NachaFile } from './types';

describe('NachaController', () => {
  let controller: NachaController;
  let service: NachaService;

  const serviceMock = {
    getSampleNachaFile: jest.fn().mockReturnValue('SAMPLE'),
    serialize: jest.fn().mockReturnValue('SERIALIZED'),
    parse: jest.fn().mockReturnValue({} as NachaFile),
    validateRoutingNumber: jest.fn().mockReturnValue({ valid: true }),
    validateFileContent: jest.fn().mockReturnValue({ valid: true, file: {} as NachaFile }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NachaController],
      providers: [
        {
          provide: NachaService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(NachaController);
    service = module.get(NachaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('gets a sample NACHA file', () => {
    const result = controller.getSample();
    expect(result).toBe('SAMPLE');
    expect(service.getSampleNachaFile).toHaveBeenCalledTimes(1);
  });

  it('serializes a NachaFile from the request body', () => {
    const file = {} as NachaFile;
    const result = controller.serialize(file);
    expect(result).toBe('SERIALIZED');
    expect(service.serialize).toHaveBeenCalledWith(file);
  });

  it('parses NACHA text from the request body', () => {
    const result = controller.parse({ content: 'RAW' });
    expect(result).toEqual({});
    expect(service.parse).toHaveBeenCalledWith('RAW');
  });

  it('validates a routing number from the route param', () => {
    const result = controller.validateRouting('011000015');
    expect(result).toEqual({ valid: true });
    expect(service.validateRoutingNumber).toHaveBeenCalledWith('011000015');
  });

  it('validates an uploaded NACHA file and returns success', () => {
    const buffer = Buffer.from('file-content', 'utf-8');
    const result = controller.validateFile({ buffer });

    expect(result).toEqual({ valid: true, file: {} });
    expect(service.validateFileContent).toHaveBeenCalledWith('file-content');
  });

  it('throws BadRequestException when no file is uploaded', () => {
    expect(() => controller.validateFile(undefined)).toThrow(BadRequestException);
  });
});


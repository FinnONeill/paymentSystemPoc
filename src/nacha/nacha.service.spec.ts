import { Test, TestingModule } from '@nestjs/testing';
import { NachaService } from './nacha.service';
import {
  serializeNachaFile,
  parseNachaFile,
  isValidRoutingNumber,
} from './index';

jest.mock('./index', () => ({
  ...jest.requireActual('./index'),
  serializeNachaFile: jest.fn().mockReturnValue('SERIALIZED'),
  parseNachaFile: jest.fn().mockReturnValue({ parsed: true }),
  isValidRoutingNumber: jest.fn().mockReturnValue(true),
}));

describe('NachaService', () => {
  let service: NachaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NachaService],
    }).compile();

    service = module.get(NachaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a sample NACHA file string', () => {
    const result = service.getSampleNachaFile();
    expect(result).toBe('SERIALIZED');
    expect(serializeNachaFile).toHaveBeenCalledTimes(1);
  });

  it('serializes a NachaFile by delegating to formatter', () => {
    const file = { test: true } as any;
    const result = service.serialize(file);
    expect(result).toBe('SERIALIZED');
    expect(serializeNachaFile).toHaveBeenCalledWith(file);
  });

  it('parses NACHA text by delegating to parser', () => {
    const result = service.parse('RAW');
    expect(result).toEqual({ parsed: true });
    expect(parseNachaFile).toHaveBeenCalledWith('RAW');
  });

  it('validates routing numbers using helper', () => {
    const result = service.validateRoutingNumber('011000015');
    expect(result).toEqual({ valid: true });
    expect(isValidRoutingNumber).toHaveBeenCalledWith('011000015');
  });

  it('returns valid: true when validateFileContent parses successfully', () => {
    const result = service.validateFileContent('GOOD');
    expect(result).toEqual({ valid: true, file: { parsed: true } });
    expect(parseNachaFile).toHaveBeenCalledWith('GOOD');
  });

  it('returns valid: false when validateFileContent throws', () => {
    (parseNachaFile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const result = service.validateFileContent('BAD');
    expect(result).toEqual({ valid: false, error: 'boom' });
  });
});


import {
  isValidRoutingNumber,
  validateEntryDetail,
  validateBatch,
  validateFile,
} from './validation';
import {
  NachaAddendaRecord,
  NachaBatch,
  NachaEntryDetail,
  NachaFile,
  ServiceClassCode,
  TransactionCode,
} from './types';

describe('validation utilities', () => {
  it('validates routing numbers using check digit algorithm', () => {
    expect(isValidRoutingNumber('011000015')).toBe(true);
    expect(isValidRoutingNumber('011000016')).toBe(false);
    expect(isValidRoutingNumber('not-a-number')).toBe(false);
  });

  it('validates a correct entry detail and rejects invalid combinations', () => {
    const baseEntry: NachaEntryDetail = {
      transactionCode: TransactionCode.CheckingCredit,
      receivingDfiRoutingNumber: '01100001',
      receivingDfiCheckDigit: '5',
      dfiAccountNumber: '123456789',
      amountCents: 100,
      individualName: 'JOHN DOE',
      addendaRecordIndicator: 0,
      traceNumber: '011000010000001',
    };

    expect(() => validateEntryDetail(baseEntry)).not.toThrow();

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        receivingDfiRoutingNumber: 'ABCDEFGH',
      }),
    ).toThrow(/must be numeric/);

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        receivingDfiCheckDigit: 'AA',
      }),
    ).toThrow(/check digit must be a single digit/);

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        amountCents: -1,
      }),
    ).toThrow(/Amount cannot be negative/);

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        individualName: '   ',
      }),
    ).toThrow(/Individual name is required/);

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        traceNumber: '123',
      }),
    ).toThrow(/Trace number must be 15 digits/);

    const addenda: NachaAddendaRecord = {
      addendaTypeCode: '05',
      paymentRelatedInformation: 'INFO',
      addendaSequenceNumber: 1,
      entryDetailSequenceNumber: 1,
    };

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        addendaRecordIndicator: 1,
        addenda,
      }),
    ).not.toThrow();

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        addendaRecordIndicator: 1,
        addenda: undefined,
      }),
    ).toThrow(/must have an addenda record/);
  });

  it('validates addenda constraints via validateEntryDetail', () => {
    const entry: NachaEntryDetail = {
      transactionCode: TransactionCode.CheckingCredit,
      receivingDfiRoutingNumber: '01100001',
      receivingDfiCheckDigit: '5',
      dfiAccountNumber: '123456789',
      amountCents: 100,
      individualName: 'JOHN DOE',
      addendaRecordIndicator: 1,
      traceNumber: '011000010000001',
      addenda: {
        addendaTypeCode: '05',
        paymentRelatedInformation: 'X'.repeat(81),
        addendaSequenceNumber: 1,
        entryDetailSequenceNumber: 1,
      },
    };

    expect(() => validateEntryDetail(entry)).toThrow(
      /Payment-related information must not exceed 80 characters/,
    );
  });

  it('validates a batch and throws on missing fields', () => {
    const goodBatch: NachaBatch = {
      serviceClassCode: ServiceClassCode.MixedDebitsAndCredits,
      companyName: 'ACME CORP',
      companyIdentification: '1234567890',
      standardEntryClassCode: 'PPD',
      companyEntryDescription: 'PAYROLL',
      effectiveEntryDate: '260101',
      originatingDfiIdentification: '01100001',
      batchNumber: 1,
      entries: [
        {
          transactionCode: TransactionCode.CheckingCredit,
          receivingDfiRoutingNumber: '01100001',
          receivingDfiCheckDigit: '5',
          dfiAccountNumber: '123456789',
          amountCents: 100,
          individualName: 'JOHN DOE',
          addendaRecordIndicator: 0,
          traceNumber: '011000010000001',
        },
      ],
    };

    expect(() => validateBatch(goodBatch)).not.toThrow();

    expect(() =>
      validateBatch({
        ...goodBatch,
        companyName: '   ',
      }),
    ).toThrow(/Company name is required/);
  });

  it('validates a file and throws on invalid routing numbers', () => {
    const goodFile: NachaFile = {
      immediateDestinationRoutingNumber: '0011000015',
      immediateOriginRoutingNumber: '0011000015',
      immediateDestinationName: 'DEST BANK',
      immediateOriginName: 'ORIGIN BANK',
      fileCreationDate: '260101',
      fileCreationTime: '0000',
      fileIdModifier: 'A',
      batches: [
        {
          serviceClassCode: ServiceClassCode.MixedDebitsAndCredits,
          companyName: 'ACME CORP',
          companyIdentification: '1234567890',
          standardEntryClassCode: 'PPD',
          companyEntryDescription: 'PAYROLL',
          effectiveEntryDate: '260101',
          originatingDfiIdentification: '01100001',
          batchNumber: 1,
          entries: [
            {
              transactionCode: TransactionCode.CheckingCredit,
              receivingDfiRoutingNumber: '01100001',
              receivingDfiCheckDigit: '5',
              dfiAccountNumber: '123456789',
              amountCents: 100,
              individualName: 'JOHN DOE',
              addendaRecordIndicator: 0,
              traceNumber: '011000010000001',
            },
          ],
        },
      ],
    };

    expect(() => validateFile(goodFile)).not.toThrow();

    expect(() =>
      validateFile({
        ...goodFile,
        immediateDestinationRoutingNumber: 'A234567890',
      }),
    ).toThrow(/routing number/i);
  });
});


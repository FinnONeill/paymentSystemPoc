import { parseNachaFile } from './parser';
import { serializeNachaFile } from './formatter';
import type { NachaFile } from './types';

describe('parseNachaFile', () => {
  it('throws when NACHA file is empty', () => {
    expect(() => parseNachaFile('   \n  ')).toThrow(/NACHA file is empty/);
  });

  it('throws when first record is not a file header', () => {
    const contents = '9'.repeat(94);
    expect(() => parseNachaFile(contents)).toThrow(/First record must be a file header/);
  });

  it('throws when unsupported record type is encountered', () => {
    const fileHeader = '1'.repeat(94);
    const badRecord = '4'.repeat(94);
    const contents = `${fileHeader}\n${badRecord}`;

    expect(() => parseNachaFile(contents)).toThrow(/Unsupported record type code: 4/);
  });

  it('parses a simple valid NACHA file with one batch and one entry', () => {
    const file: NachaFile = {
      immediateDestinationRoutingNumber: '0011000015',
      immediateOriginRoutingNumber: '0011000015',
      immediateDestinationName: 'DEST BANK',
      immediateOriginName: 'ORIGIN BANK',
      fileCreationDate: '260101',
      fileCreationTime: '0000',
      fileIdModifier: 'A',
      batches: [
        {
          serviceClassCode: 200,
          companyName: 'ACME CORP',
          companyIdentification: '1234567890',
          standardEntryClassCode: 'PPD',
          companyEntryDescription: 'PAYROLL',
          effectiveEntryDate: '260101',
          originatingDfiIdentification: '01100001',
          batchNumber: 1,
          entries: [
            {
              transactionCode: 22,
              receivingDfiRoutingNumber: '01100001',
              receivingDfiCheckDigit: '5',
              dfiAccountNumber: '123456789',
              amountCents: 1000,
              individualName: 'JOHN DOE',
              addendaRecordIndicator: 0,
              traceNumber: '011000010000001',
            },
          ],
        },
      ],
    };

    const contents = serializeNachaFile(file);
    const result: NachaFile = parseNachaFile(contents);

    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].entries).toHaveLength(1);
    expect(result.batches[0].entries[0]).toMatchObject({
      amountCents: 1000,
      individualName: 'JOHN DOE',
      addendaRecordIndicator: 0,
    });
  });
});


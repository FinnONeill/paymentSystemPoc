import {
  NachaFile,
  ServiceClassCode,
  TransactionCode,
} from './types';
import { serializeNachaFile } from './formatter';
import { parseNachaFile } from './parser';
import {
  isValidRoutingNumber,
  validateBatch,
  validateEntryDetail,
  validateFile,
} from './validation';

describe('NACHA library', () => {
  const sampleRouting = '011000015'; // Valid ABA (Federal Reserve Bank of Boston).

  function buildValidFile(): NachaFile {
    const receivingRouting = sampleRouting.slice(0, 8);
    const checkDigit = sampleRouting.slice(8);

    return {
      immediateDestinationRoutingNumber: `0${sampleRouting}`,
      immediateOriginRoutingNumber: `0${sampleRouting}`,
      immediateDestinationName: 'DEST BANK',
      immediateOriginName: 'ORIGIN BANK',
      fileCreationDate: '260101',
      fileCreationTime: '0101',
      fileIdModifier: 'A',
      batches: [
        {
          serviceClassCode: ServiceClassCode.MixedDebitsAndCredits,
          companyName: 'ACME CORP',
          companyIdentification: '1234567890',
          standardEntryClassCode: 'PPD',
          companyEntryDescription: 'PAYROLL',
          effectiveEntryDate: '260102',
          originatingDfiIdentification: '11000015',
          batchNumber: 1,
          entries: [
            {
              transactionCode: TransactionCode.CheckingCredit,
              receivingDfiRoutingNumber: receivingRouting,
              receivingDfiCheckDigit: checkDigit,
              dfiAccountNumber: '123456789',
              amountCents: 12345,
              individualIdNumber: 'ID123',
              individualName: 'JOHN DOE',
              discretionaryData: 'AA',
              addendaRecordIndicator: 0,
              traceNumber: '110000150000001',
            },
          ],
        },
      ],
    };
  }

  it('validates routing numbers with check digit', () => {
    expect(isValidRoutingNumber(sampleRouting)).toBe(true);
    expect(isValidRoutingNumber('123456789')).toBe(false);
    expect(isValidRoutingNumber('123')).toBe(false);
  });

  it('validates individual entry detail records', () => {
    const file = buildValidFile();
    const batch = file.batches[0];
    if (!batch) {
      throw new Error('Expected batch to be defined');
    }
    const entry = batch.entries[0];
    if (!entry) {
      throw new Error('Expected entry to be defined');
    }

    expect(() => validateEntryDetail(entry)).not.toThrow();

    expect(() =>
      validateEntryDetail({
        ...entry,
        receivingDfiRoutingNumber: '1234567',
      }),
    ).toThrow(/8 digits/);
  });

  it('validates batches and files', () => {
    const file = buildValidFile();
    const batch = file.batches[0];
    if (!batch) {
      throw new Error('Expected batch to be defined');
    }

    expect(() => validateBatch(batch)).not.toThrow();
    expect(() => validateFile(file)).not.toThrow();

    expect(() => validateFile({ ...file, batches: [] })).toThrow(
      /at least one batch/,
    );
  });

  it('produces detailed validation errors for invalid data', () => {
    const file = buildValidFile();
    const baseBatch = file.batches[0];
    if (!baseBatch) {
      throw new Error('Expected batch to be defined');
    }
    const baseEntry = baseBatch.entries[0];
    if (!baseEntry) {
      throw new Error('Expected entry to be defined');
    }

    // Entry-level validation branches.
    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        transactionCode: 99 as any,
      }),
    ).toThrow(/Unsupported transaction code/);

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        receivingDfiRoutingNumber: 'ABCDEFGH',
      }),
    ).toThrow(/must be numeric/);

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        receivingDfiRoutingNumber: '12345678',
        receivingDfiCheckDigit: '9',
      }),
    ).toThrow(/failed check digit validation/);

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        receivingDfiRoutingNumber: '12345678',
        receivingDfiCheckDigit: 'X',
      }),
    ).toThrow(/single digit/);

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        amountCents: -1,
      }),
    ).toThrow(/negative/);

    expect(() =>
      validateEntryDetail({
        ...baseEntry,
        amountCents: 10_000_000_000,
      }),
    ).toThrow(/exceeds NACHA field size/);

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

    // Batch-level validation branches.
    expect(() =>
      validateBatch({
        ...baseBatch,
        companyName: '   ',
      }),
    ).toThrow(/Company name is required/);

    expect(() =>
      validateBatch({
        ...baseBatch,
        companyIdentification: '   ',
      }),
    ).toThrow(/Company identification is required/);

    expect(() =>
      validateBatch({
        ...baseBatch,
        standardEntryClassCode: 'PpD',
      }),
    ).toThrow(/three uppercase letters/);

    expect(() =>
      validateBatch({
        ...baseBatch,
        companyEntryDescription: '',
      }),
    ).toThrow(/Company entry description is required/);

    expect(() =>
      validateBatch({
        ...baseBatch,
        effectiveEntryDate: '12345',
      }),
    ).toThrow(/YYMMDD/);

    expect(() =>
      validateBatch({
        ...baseBatch,
        originatingDfiIdentification: '1234567',
      }),
    ).toThrow(/8 digits/);

    expect(() =>
      validateBatch({
        ...baseBatch,
        batchNumber: 0,
      }),
    ).toThrow(/Batch number/);

    expect(() =>
      validateBatch({
        ...baseBatch,
        entries: [],
      }),
    ).toThrow(/at least one entry/);

    // File-level validation branches.
    expect(() =>
      validateFile({
        ...file,
        immediateDestinationRoutingNumber: '12345',
      }),
    ).toThrow(/Immediate destination routing number/);

    expect(() =>
      validateFile({
        ...file,
        immediateOriginRoutingNumber: '12345',
      }),
    ).toThrow(/Immediate origin routing number/);

    expect(() =>
      validateFile({
        ...file,
        immediateDestinationRoutingNumber: ' 123456789',
      }),
    ).toThrow(/check digit validation/);

    expect(() =>
      validateFile({
        ...file,
        immediateOriginRoutingNumber: ' 123456789',
      }),
    ).toThrow(/check digit validation/);

    expect(() =>
      validateFile({
        ...file,
        immediateDestinationName: '   ',
      }),
    ).toThrow(/Immediate destination name is required/);

    expect(() =>
      validateFile({
        ...file,
        immediateOriginName: '',
      }),
    ).toThrow(/Immediate origin name is required/);

    expect(() =>
      validateFile({
        ...file,
        fileCreationDate: '12345',
      }),
    ).toThrow(/File creation date/);

    expect(() =>
      validateFile({
        ...file,
        fileCreationTime: '123',
      }),
    ).toThrow(/File creation time/);

    expect(() =>
      validateFile({
        ...file,
        fileIdModifier: 'AB',
      }),
    ).toThrow(/File ID modifier/);
  });

  it('truncates overlong text fields when formatting', () => {
    const file = buildValidFile();
    const longFile: NachaFile = {
      ...file,
      immediateDestinationName: 'DESTINATION BANK WITH A VERY LONG NAME',
      immediateOriginName: 'ORIGIN BANK WITH A VERY LONG NAME',
      batches: file.batches.map((batch) => ({
        ...batch,
        companyName: 'ACME CORPORATION WITH A VERY LONG NAME',
        companyEntryDescription: 'DESCRIPTION THAT IS TOO LONG',
      })),
    };

    const text = serializeNachaFile(longFile);
    const [header] = text.split('\n');

    // Names are truncated to their fixed-width fields but overall length remains 94.
    expect(header).toHaveLength(94);
  });

  it('serializes a valid NACHA file with correct line lengths', () => {
    const file = buildValidFile();
    const output = serializeNachaFile(file);
    const lines = output.split('\n');

    expect(lines.length).toBe(5);
    for (const line of lines) {
      expect(line.length).toBe(94);
    }

    expect(lines[0][0]).toBe('1');
    expect(lines[1][0]).toBe('5');
    expect(lines[2][0]).toBe('6');
    expect(lines[3][0]).toBe('8');
    expect(lines[4][0]).toBe('9');
  });

  it('parses a serialized file back to an equivalent object', () => {
    const original = buildValidFile();
    const text = serializeNachaFile(original);
    const parsed = parseNachaFile(text);

    expect(parsed.immediateDestinationRoutingNumber).toBe(
      original.immediateDestinationRoutingNumber,
    );
    expect(parsed.batches).toHaveLength(1);
    expect(parsed.batches[0]!.entries).toHaveLength(1);
    const parsedEntry = parsed.batches[0]!.entries[0]!;
    const originalEntry = original.batches[0]!.entries[0]!;
    expect(parsedEntry.amountCents).toBe(originalEntry.amountCents);
    expect(parsedEntry.traceNumber).toBe(originalEntry.traceNumber);
  });

  it('throws on malformed contents or record ordering', () => {
    expect(() => parseNachaFile('')).toThrow(/empty/);

    const file = buildValidFile();
    const text = serializeNachaFile(file);
    const lines = text.split('\n');
    const reordered = [lines[0], lines[2], lines[1], lines[3], lines[4]].join(
      '\n',
    );

    expect(() => parseNachaFile(reordered)).toThrow(/batch header/);
  });

  it('rejects invalid numeric fields during parsing', () => {
    const file = buildValidFile();
    const text = serializeNachaFile(file);
    const lines = text.split('\n');
    const corruptedEntry =
      lines[2].slice(0, 29) + 'ABCDEF' + lines[2].slice(35);
    const corrupted = [lines[0], lines[1], corruptedEntry, lines[3], lines[4]].join(
      '\n',
    );

    expect(() => parseNachaFile(corrupted)).toThrow(/Invalid numeric value/);
  });

  it('handles multiple entries including debits and credits in totals', () => {
    const file = buildValidFile();
    const batch = file.batches[0];
    if (!batch) {
      throw new Error('Expected batch to be defined');
    }

    const creditEntry = batch.entries[0];
    if (!creditEntry) {
      throw new Error('Expected credit entry to be defined');
    }

    const debitEntry = {
      ...creditEntry,
      transactionCode: TransactionCode.CheckingDebit,
      amountCents: 5000,
      traceNumber: '110000150000002',
    };

    const extended: NachaFile = {
      ...file,
      batches: [
        {
          ...batch,
          entries: [creditEntry, debitEntry],
        },
      ],
    };

    const text = serializeNachaFile(extended);
    const lines = text.split('\n');

    // Batch control (8) and file control (9) should both exist and be 94 chars.
    expect(lines[4][0]).toBe('8');
    expect(lines[5][0]).toBe('9');
    expect(lines[4]).toHaveLength(94);
    expect(lines[5]).toHaveLength(94);
  });

  it('throws for invalid file header, batch header and entry detail shapes', () => {
    const file = buildValidFile();
    const text = serializeNachaFile(file);
    const lines = text.split('\n');

    // Shorten file header
    const badHeader = lines[0].slice(0, 90);
    const withBadHeader = [badHeader, ...lines.slice(1)].join('\n');
    expect(() => parseNachaFile(withBadHeader)).toThrow(/File header record/);

    // Shorten batch header
    const badBatchHeader = lines[1].slice(0, 90);
    const withBadBatchHeader = [lines[0], badBatchHeader, ...lines.slice(2)].join(
      '\n',
    );
    expect(() => parseNachaFile(withBadBatchHeader)).toThrow(/Batch header record/);

    // Shorten entry detail
    const badEntry = lines[2].slice(0, 90);
    const withBadEntry = [lines[0], lines[1], badEntry, ...lines.slice(3)].join(
      '\n',
    );
    expect(() => parseNachaFile(withBadEntry)).toThrow(/Entry detail record/);
  });

  it('throws for unsupported record type and batch control before header', () => {
    const file = buildValidFile();
    const text = serializeNachaFile(file);
    const lines = text.split('\n');

    // Introduce an unknown record type code "7".
    const unknownRecord = '7'.padEnd(94, 'X');
    const withUnknown = [lines[0], unknownRecord, ...lines.slice(1)].join('\n');
    expect(() => parseNachaFile(withUnknown)).toThrow(/Unsupported record type/);

    // Put batch control before any batch header.
    const batchControlFirst = [lines[0], lines[3], lines[1], lines[2], lines[4]].join(
      '\n',
    );
    expect(() => parseNachaFile(batchControlFirst)).toThrow(/Batch control record/);
  });

  it('defaults missing file creation time to 0000 in the header', () => {
    const file = buildValidFile();
    // Omit the optional fileCreationTime to exercise the defaulting branch.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fileCreationTime: _ignored, ...rest } = file;
    const withoutTime: NachaFile = {
      ...rest,
    };

    const text = serializeNachaFile(withoutTime);
    const [header] = text.split('\n');

    expect(header).toHaveLength(94);
    // HHMM field occupies columns 29–32 in the file header.
    expect(header.slice(29, 33)).toBe('0000');
  });

  it('handles optional entry text fields when omitted during formatting', () => {
    const file = buildValidFile();
    const batch = file.batches[0];
    if (!batch) {
      throw new Error('Expected batch to be defined');
    }
    const baseEntry = batch.entries[0];
    if (!baseEntry) {
      throw new Error('Expected entry to be defined');
    }

    const entryWithoutOptionals: NachaEntryDetail = {
      ...baseEntry,
      individualIdNumber: undefined,
      discretionaryData: undefined,
    };

    const minimalFile: NachaFile = {
      ...file,
      batches: [
        {
          ...batch,
          entries: [entryWithoutOptionals],
        },
      ],
    };

    const text = serializeNachaFile(minimalFile);
    const lines = text.split('\n');
    const entryLine = lines[2];

    expect(entryLine).toHaveLength(94);
    // Individual ID number and discretionary data fields should be space-filled.
    expect(entryLine.slice(39, 54).trim()).toBe('');
    expect(entryLine.slice(76, 78).trim()).toBe('');
  });

  it('treats all-space numeric fields as zero when parsing', () => {
    const file = buildValidFile();
    const text = serializeNachaFile(file);
    const lines = text.split('\n');

    const originalEntry = lines[2];
    if (!originalEntry) {
      throw new Error('Expected entry line to be defined');
    }

    // Overwrite the amount field (columns 29–38) with spaces so that the
    // parser sees an all-space numeric field and normalizes it to 0.
    const spacesForAmount = ' '.repeat(10);
    const entryWithSpaces =
      originalEntry.slice(0, 29) + spacesForAmount + originalEntry.slice(39);

    const mutated = [lines[0], lines[1], entryWithSpaces, lines[3], lines[4]].join(
      '\n',
    );

    const parsed = parseNachaFile(mutated);
    const parsedEntry = parsed.batches[0]!.entries[0]!;
    expect(parsedEntry.amountCents).toBe(0);
  });

  it('rejects when the first record is not a file header', () => {
    const file = buildValidFile();
    const text = serializeNachaFile(file);
    const lines = text.split('\n');
    const header = lines[0];
    if (!header) {
      throw new Error('Expected header line to be defined');
    }

    const badHeader = '0' + header.slice(1);
    const mutated = [badHeader, ...lines.slice(1)].join('\n');

    expect(() => parseNachaFile(mutated)).toThrow(
      /First record must be a file header/,
    );
  });

  it('infers the end of the final batch when no batch control record is present', () => {
    const file = buildValidFile();
    const text = serializeNachaFile(file);
    const lines = text.split('\n');

    // Remove the batch control (record type 8) so that the parser encounters
    // the file control (record type 9) while a batch is still "open". This
    // exercises the branch that pushes a trailing batch after the main loop.
    const withoutBatchControl = [lines[0], lines[1], lines[2], lines[4]].join(
      '\n',
    );

    const parsed = parseNachaFile(withoutBatchControl);
    expect(parsed.batches).toHaveLength(1);
    expect(parsed.batches[0]!.entries).toHaveLength(1);
  });
});


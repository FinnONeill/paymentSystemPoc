import {
  NachaBatch,
  NachaEntryDetail,
  NachaFile,
  NachaAddendaRecord,
  ServiceClassCode,
  TransactionCode,
} from './types';
import { validateFile } from './validation';

/**
 * Safely extracts a fixed-width substring from a line.
 */
function slice(line: string, start: number, end: number): string {
  return line.slice(start, end);
}

/**
 * Normalizes text fields by trimming trailing spaces.
 */
function normalizeText(value: string): string {
  return value.trimEnd();
}

/**
 * Parses a numeric field into a number, returning 0 for all-space values.
 */
function parseNumeric(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isNaN(numeric)) {
    throw new TypeError(`Invalid numeric value: "${value}"`);
  }
  return numeric;
}

/**
 * Parses the file header record (type 1) into the top-level file metadata.
 */
function parseFileHeader(line: string): Omit<NachaFile, 'batches'> {
  if (line.length < 94) {
    throw new Error('File header record must be 94 characters');
  }

  const recordTypeCode = slice(line, 0, 1);
  if (recordTypeCode !== '1') {
    throw new Error('First record must be a file header (type 1)');
  }

  const immediateDestinationRoutingNumber = slice(line, 3, 13);
  const immediateOriginRoutingNumber = slice(line, 13, 23);
  const fileCreationDate = slice(line, 23, 29);
  const fileCreationTime = slice(line, 29, 33);
  const fileIdModifier = slice(line, 33, 34);
  const immediateDestinationName = normalizeText(slice(line, 40, 63));
  const immediateOriginName = normalizeText(slice(line, 63, 86));
  const referenceCode = normalizeText(slice(line, 86, 94));

  return {
    immediateDestinationRoutingNumber,
    immediateOriginRoutingNumber,
    immediateDestinationName,
    immediateOriginName,
    fileCreationDate,
    fileCreationTime,
    fileIdModifier,
    referenceCode: referenceCode || undefined,
  };
}

/**
 * Parses a batch header record (type 5) into a `NachaBatch` shell.
 */
function parseBatchHeader(line: string): Omit<NachaBatch, 'entries'> {
  if (line.length < 94) {
    throw new Error('Batch header record must be 94 characters');
  }

  const recordTypeCode = slice(line, 0, 1);
  if (recordTypeCode !== '5') {
    throw new Error('Batch header record must have type code 5');
  }

  const serviceClassCode = parseNumeric(slice(line, 1, 4)) as ServiceClassCode;
  const companyName = normalizeText(slice(line, 4, 20));
  const companyDiscretionaryData = normalizeText(slice(line, 20, 40));
  const companyIdentification = normalizeText(slice(line, 40, 50));
  const standardEntryClassCode = slice(line, 50, 53) as
    | 'PPD'
    | 'CCD'
    | 'CTX';
  const companyEntryDescription = normalizeText(slice(line, 53, 63));
  const companyDescriptiveDate = normalizeText(slice(line, 63, 69));
  const effectiveEntryDate = slice(line, 69, 75);
  const settlementDateJulian = slice(line, 75, 78);
  const originatorStatusCode = slice(line, 78, 79);
  const originatingDfiIdentification = slice(line, 79, 87);
  const batchNumber = parseNumeric(slice(line, 87, 94));

  return {
    serviceClassCode,
    companyName,
    companyDiscretionaryData: companyDiscretionaryData || undefined,
    companyIdentification,
    standardEntryClassCode,
    companyEntryDescription,
    companyDescriptiveDate: companyDescriptiveDate || undefined,
    effectiveEntryDate,
    settlementDateJulian: settlementDateJulian || undefined,
    originatorStatusCode: originatorStatusCode || undefined,
    originatingDfiIdentification,
    batchNumber,
  };
}

/**
 * Parses an entry detail record (type 6) into a `NachaEntryDetail`.
 */
function parseEntryDetail(line: string): NachaEntryDetail {
  if (line.length < 94) {
    throw new Error('Entry detail record must be 94 characters');
  }

  const recordTypeCode = slice(line, 0, 1);
  if (recordTypeCode !== '6') {
    throw new Error('Entry detail record must have type code 6');
  }

  const transactionCode = parseNumeric(slice(line, 1, 3)) as TransactionCode;
  const receivingDfiRoutingNumber = slice(line, 3, 11);
  const receivingDfiCheckDigit = slice(line, 11, 12);
  const dfiAccountNumber = normalizeText(slice(line, 12, 29));
  const amountCents = parseNumeric(slice(line, 29, 39));
  const individualIdNumber = normalizeText(slice(line, 39, 54));
  const individualName = normalizeText(slice(line, 54, 76));
  const discretionaryData = normalizeText(slice(line, 76, 78));
  const addendaRecordIndicator = parseNumeric(
    slice(line, 78, 79),
  ) as 0 | 1;
  const traceNumber = slice(line, 79, 94);

  return {
    transactionCode,
    receivingDfiRoutingNumber,
    receivingDfiCheckDigit,
    dfiAccountNumber,
    amountCents,
    individualIdNumber: individualIdNumber || undefined,
    individualName,
    discretionaryData: discretionaryData || undefined,
    addendaRecordIndicator,
    traceNumber,
  };
}

/**
 * Parses an entry detail addenda record (type 7) into a `NachaAddendaRecord`.
 * NACHA positions: 1=record type, 2-3=addenda type code, 4-83=payment info (80 chars),
 * 84-87=addenda sequence number, 88-94=entry detail sequence number.
 */
function parseAddendaRecord(line: string): NachaAddendaRecord {
  if (line.length < 94) {
    throw new Error('Addenda record must be 94 characters');
  }

  const recordTypeCode = slice(line, 0, 1);
  if (recordTypeCode !== '7') {
    throw new Error('Addenda record must have type code 7');
  }

  const addendaTypeCode = slice(line, 1, 3);
  const paymentRelatedInformation = normalizeText(slice(line, 3, 83));
  const addendaSequenceNumber = parseNumeric(slice(line, 83, 87));
  const entryDetailSequenceNumber = parseNumeric(slice(line, 87, 94));

  return {
    addendaTypeCode,
    paymentRelatedInformation,
    addendaSequenceNumber,
    entryDetailSequenceNumber,
  };
}

/**
 * Parses a NACHA file string into a fully validated `NachaFile` object.
 */
type ParseState = {
  batches: NachaBatch[];
  currentBatch: NachaBatch | null;
  done: boolean;
};

function startNewBatch(state: ParseState, line: string): ParseState {
  const batchBase = parseBatchHeader(line);
  const batches = state.currentBatch
    ? [...state.batches, state.currentBatch]
    : state.batches;

  return {
    batches,
    currentBatch: { ...batchBase, entries: [] },
    done: false,
  };
}

function appendEntryDetail(state: ParseState, line: string): ParseState {
  if (!state.currentBatch) {
    throw new Error(
      'Entry detail record encountered before any batch header',
    );
  }

  const entry = parseEntryDetail(line);

  return {
    ...state,
    currentBatch: {
      ...state.currentBatch,
      entries: [...state.currentBatch.entries, entry],
    },
  };
}

function attachAddendaRecord(state: ParseState, line: string): ParseState {
  if (!state.currentBatch) {
    throw new Error(
      'Addenda record encountered before any batch header',
    );
  }

  const batch = state.currentBatch;
  const lastEntryIndex = batch.entries.length - 1;

  if (lastEntryIndex < 0) {
    throw new Error('Addenda record must follow an entry detail record');
  }

  const lastEntry = batch.entries[lastEntryIndex];

  if (lastEntry.addendaRecordIndicator !== 1) {
    throw new Error(
      'Addenda record may only follow an entry with addenda record indicator 1',
    );
  }

  if (lastEntry.addenda) {
    throw new Error('Only one addenda record per entry is supported');
  }

  const addenda = parseAddendaRecord(line);
  const entryWithAddenda: NachaEntryDetail = { ...lastEntry, addenda };
  const newEntries = [...batch.entries];
  newEntries[lastEntryIndex] = entryWithAddenda;

  return {
    ...state,
    currentBatch: { ...batch, entries: newEntries },
  };
}

function closeBatch(state: ParseState): ParseState {
  if (!state.currentBatch) {
    throw new Error(
      'Batch control record encountered before any batch header',
    );
  }

  return {
    batches: [...state.batches, state.currentBatch],
    currentBatch: null,
    done: false,
  };
}

function markFileControl(state: ParseState): ParseState {
  return {
    ...state,
    done: true,
  };
}

function processRecordLine(line: string, state: ParseState): ParseState {
  const recordTypeCode = line[0];

  switch (recordTypeCode) {
    case '5':
      return startNewBatch(state, line);
    case '6':
      return appendEntryDetail(state, line);
    case '7':
      return attachAddendaRecord(state, line);
    case '8':
      return closeBatch(state);
    case '9':
      return markFileControl(state);
    default:
      throw new Error(`Unsupported record type code: ${recordTypeCode}`);
  }
}

export function parseNachaFile(contents: string): NachaFile {
  const rawLines = contents
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!rawLines.length) {
    throw new Error('NACHA file is empty');
  }

  const fileHeaderLine = rawLines[0];
  const fileBase = parseFileHeader(fileHeaderLine);

  let state: ParseState = {
    batches: [],
    currentBatch: null,
    done: false,
  };

  for (let i = 1; i < rawLines.length && !state.done; i += 1) {
    const line = rawLines[i];
    state = processRecordLine(line, state);
  }

  if (state.currentBatch) {
    state = {
      ...state,
      batches: [...state.batches, state.currentBatch],
      currentBatch: null,
    };
  }

  const result: NachaFile = {
    ...fileBase,
    batches: state.batches,
  };

  validateFile(result);

  return result;
}


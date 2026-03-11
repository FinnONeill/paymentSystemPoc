import {
  NachaAddendaRecord,
  NachaBatch,
  NachaEntryDetail,
  NachaFile,
  TransactionCode,
} from './types';

/**
 * Validates that a string consists only of digits.
 */
function isNumeric(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

/**
 * Validates an ABA routing number using the standard check digit algorithm.
 * Returns true when the routing number (9 digits) is structurally valid.
 */
export function isValidRoutingNumber(routingNumber: string): boolean {
  if (!/^[0-9]{9}$/.test(routingNumber)) {
    return false;
  }

  const digits = routingNumber.split('').map((d) => Number.parseInt(d, 10));

  // Weighted sum algorithm defined by the ABA (positions 1–9).
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const sum = digits.reduce(
    (acc, digit, index) => acc + digit * weights[index]!,
    0,
  );
  return sum % 10 === 0;
}

/**
 * Ensures that a numeric field is within the allowed inclusive range.
 */
function assertInRange(
  value: number,
  min: number,
  max: number,
  fieldName: string,
): void {
  if (Number.isNaN(value) || value < min || value > max) {
    throw new Error(
      `${fieldName} must be between ${min} and ${max}, received ${value}`,
    );
  }
}

/**
 * Validates a single entry detail record and throws if it is invalid.
 */
export function validateEntryDetail(entry: NachaEntryDetail): void {
  if (!Object.values(TransactionCode).includes(entry.transactionCode)) {
    throw new Error(`Unsupported transaction code: ${entry.transactionCode}`);
  }

  if (!isNumeric(entry.receivingDfiRoutingNumber)) {
    throw new Error('Receiving DFI routing number must be numeric');
  }

  if (entry.receivingDfiRoutingNumber.length !== 8) {
    throw new Error('Receiving DFI routing number must be 8 digits');
  }

  if (!/^[0-9]$/.test(entry.receivingDfiCheckDigit)) {
    throw new Error('Receiving DFI check digit must be a single digit');
  }

  const fullRouting =
    entry.receivingDfiRoutingNumber + entry.receivingDfiCheckDigit;
  if (!isValidRoutingNumber(fullRouting)) {
    throw new Error('Receiving DFI routing number failed check digit validation');
  }

  if (entry.amountCents < 0) {
    throw new Error('Amount cannot be negative');
  }

  assertInRange(
    entry.amountCents,
    0,
    9_999_999_999,
    'Amount (cents) exceeds NACHA field size',
  );

  if (!entry.individualName.trim()) {
    throw new Error('Individual name is required');
  }

  if (!/^[0-9]{15}$/.test(entry.traceNumber)) {
    throw new Error('Trace number must be 15 digits');
  }

  if (entry.addendaRecordIndicator === 1 && !entry.addenda) {
    throw new Error(
      'Entry with addenda record indicator 1 must have an addenda record',
    );
  }
  if (entry.addendaRecordIndicator === 0 && entry.addenda) {
    throw new Error(
      'Entry with addenda record indicator 0 must not have an addenda record',
    );
  }
  if (entry.addenda) {
    validateAddendaRecord(entry.addenda);
  }
}

/**
 * Validates a single addenda record (type 7).
 */
function validateAddendaRecord(addenda: NachaAddendaRecord): void {
  if (addenda.addendaTypeCode.length !== 2) {
    throw new Error('Addenda type code must be 2 characters');
  }
  if (addenda.paymentRelatedInformation.length > 80) {
    throw new Error(
      'Payment-related information must not exceed 80 characters',
    );
  }
  assertInRange(
    addenda.addendaSequenceNumber,
    1,
    9999,
    'Addenda sequence number',
  );
  assertInRange(
    addenda.entryDetailSequenceNumber,
    1,
    9_999_999,
    'Entry detail sequence number',
  );
}

/**
 * Validates a single batch and all nested entries.
 */
export function validateBatch(batch: NachaBatch): void {
  if (!batch.companyName.trim()) {
    throw new Error('Company name is required');
  }

  if (!batch.companyIdentification.trim()) {
    throw new Error('Company identification is required');
  }

  if (!/^[A-Z]{3}$/.test(batch.standardEntryClassCode)) {
    throw new Error('Standard entry class code must be three uppercase letters');
  }

  if (!batch.companyEntryDescription.trim()) {
    throw new Error('Company entry description is required');
  }

  if (!/^[0-9]{6}$/.test(batch.effectiveEntryDate)) {
    throw new Error('Effective entry date must be in YYMMDD format');
  }

  if (!/^[0-9]{8}$/.test(batch.originatingDfiIdentification)) {
    throw new Error('Originating DFI identification must be 8 digits');
  }

  assertInRange(batch.batchNumber, 1, 9_999_999, 'Batch number');

  if (!batch.entries.length) {
    throw new Error('Batch must contain at least one entry');
  }

  for (const entry of batch.entries) {
    validateEntryDetail(entry);
  }
}

/**
 * Validates a full NACHA file including all batches and entries.
 */
export function validateFile(file: NachaFile): void {
  if (!/^[ 0][0-9]{9}$/.test(file.immediateDestinationRoutingNumber)) {
    throw new Error(
      'Immediate destination routing number must be a 10-character field (leading space or zero followed by 9 digits)',
    );
  }

  const destinationRoutingNine = file.immediateDestinationRoutingNumber.slice(1);
  if (!isValidRoutingNumber(destinationRoutingNine)) {
    throw new Error(
      'Immediate destination routing number failed check digit validation',
    );
  }

  if (!/^[ 0][0-9]{9}$/.test(file.immediateOriginRoutingNumber)) {
    throw new Error(
      'Immediate origin routing number must be a 10-character field (leading space or zero followed by 9 digits)',
    );
  }

  const originRoutingNine = file.immediateOriginRoutingNumber.slice(1);
  if (!isValidRoutingNumber(originRoutingNine)) {
    throw new Error(
      'Immediate origin routing number failed check digit validation',
    );
  }

  if (!file.immediateDestinationName.trim()) {
    throw new Error('Immediate destination name is required');
  }

  if (!file.immediateOriginName.trim()) {
    throw new Error('Immediate origin name is required');
  }

  if (!/^[0-9]{6}$/.test(file.fileCreationDate)) {
    throw new Error('File creation date must be in YYMMDD format');
  }

  if (file.fileCreationTime && !/^[0-9]{4}$/.test(file.fileCreationTime)) {
    throw new Error('File creation time must be in HHMM format');
  }

  if (!/^[A-Z0-9]$/.test(file.fileIdModifier)) {
    throw new Error('File ID modifier must be a single alphanumeric character');
  }

  if (!file.batches.length) {
    throw new Error('File must contain at least one batch');
  }

  for (const batch of file.batches) {
    validateBatch(batch);
  }
}


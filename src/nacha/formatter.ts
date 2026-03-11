import { NachaBatch, NachaEntryDetail, NachaFile } from './types';
import { validateBatch, validateFile } from './validation';

/**
 * Pads a string with spaces on the right to a fixed length.
 */
function padRight(value: string, length: number): string {
  const truncated = value.length > length ? value.slice(0, length) : value;
  return truncated.padEnd(length, ' ');
}

/**
 * Formats the file header (record type code 1).
 */
function formatFileHeader(file: NachaFile): string {
  const recordTypeCode = '1';
  const priorityCode = '01';
  const immediateDestination = file.immediateDestinationRoutingNumber;
  const immediateOrigin = file.immediateOriginRoutingNumber;
  const fileCreationDate = file.fileCreationDate;
  const fileCreationTime = file.fileCreationTime ?? '0000';
  const fileIdModifier = file.fileIdModifier;
  const recordSize = '094';
  const blockingFactor = '10';
  const formatCode = '1';
  const immediateDestinationName = padRight(file.immediateDestinationName, 23);
  const immediateOriginName = padRight(file.immediateOriginName, 23);
  const referenceCode = padRight(file.referenceCode ?? '', 8);

  const line =
    recordTypeCode +
    priorityCode +
    immediateDestination +
    immediateOrigin +
    fileCreationDate +
    fileCreationTime +
    fileIdModifier +
    recordSize +
    blockingFactor +
    formatCode +
    immediateDestinationName +
    immediateOriginName +
    referenceCode;

  return line.padEnd(94, ' ');
}

/**
 * Formats the batch header (record type code 5).
 */
function formatBatchHeader(batch: NachaBatch, batchNumber: number): string {
  const recordTypeCode = '5';
  const serviceClassCode = batch.serviceClassCode.toString().padStart(3, '0');
  const companyName = padRight(batch.companyName, 16);
  const companyDiscretionaryData = padRight(
    batch.companyDiscretionaryData ?? '',
    20,
  );
  const companyIdentification = padRight(batch.companyIdentification, 10);
  const standardEntryClassCode = batch.standardEntryClassCode;
  const companyEntryDescription = padRight(batch.companyEntryDescription, 10);
  const companyDescriptiveDate = padRight(
    batch.companyDescriptiveDate ?? '',
    6,
  );
  const effectiveEntryDate = batch.effectiveEntryDate;
  const settlementDateJulian = (batch.settlementDateJulian ?? '').padStart(
    3,
    ' ',
  );
  const originatorStatusCode = batch.originatorStatusCode ?? '1';
  const originatingDfiIdentification = batch.originatingDfiIdentification;
  const batchNumberField = batchNumber.toString().padStart(7, '0');

  const line =
    recordTypeCode +
    serviceClassCode +
    companyName +
    companyDiscretionaryData +
    companyIdentification +
    standardEntryClassCode +
    companyEntryDescription +
    companyDescriptiveDate +
    effectiveEntryDate +
    settlementDateJulian +
    originatorStatusCode +
    originatingDfiIdentification +
    batchNumberField;

  return line.padEnd(94, ' ');
}

/**
 * Formats a single entry detail record (record type code 6).
 */
function formatEntryDetail(entry: NachaEntryDetail, tracePrefix: string): string {
  const recordTypeCode = '6';
  const transactionCode = entry.transactionCode.toString().padStart(2, '0');
  const receivingDfiIdentification = entry.receivingDfiRoutingNumber;
  const checkDigit = entry.receivingDfiCheckDigit;
  const dfiAccountNumber = padRight(entry.dfiAccountNumber, 17);
  const amount = entry.amountCents.toString().padStart(10, '0');
  const individualIdNumber = padRight(entry.individualIdNumber ?? '', 15);
  const individualName = padRight(entry.individualName, 22);
  const discretionaryData = padRight(entry.discretionaryData ?? '', 2);
  const addendaRecordIndicator = entry.addendaRecordIndicator.toString();
  const traceNumber = entry.traceNumber;

  const line =
    recordTypeCode +
    transactionCode +
    receivingDfiIdentification +
    checkDigit +
    dfiAccountNumber +
    amount +
    individualIdNumber +
    individualName +
    discretionaryData +
    addendaRecordIndicator +
    traceNumber;

  return line.padEnd(94, ' ');
}

/**
 * Formats a batch control record (record type code 8) aggregating all entries.
 */
function formatBatchControl(
  batch: NachaBatch,
  batchNumber: number,
): string {
  const recordTypeCode = '8';
  const serviceClassCode = batch.serviceClassCode.toString().padStart(3, '0');
  const entryAddendaCount = batch.entries.length
    .toString()
    .padStart(6, '0');

  const entryHash = batch.entries
    .reduce((sum, entry) => {
      const routing = entry.receivingDfiRoutingNumber;
      return sum + Number.parseInt(routing, 10);
    }, 0)
    .toString()
    .slice(-10)
    .padStart(10, '0');

  const totalDebit = batch.entries
    .filter((entry) => entry.transactionCode.toString().endsWith('7'))
    .reduce((sum, entry) => sum + entry.amountCents, 0)
    .toString()
    .padStart(12, '0');

  const totalCredit = batch.entries
    .filter((entry) => entry.transactionCode.toString().endsWith('2'))
    .reduce((sum, entry) => sum + entry.amountCents, 0)
    .toString()
    .padStart(12, '0');

  const companyIdentification = padRight(batch.companyIdentification, 10);
  const messageAuthenticationCode = ''.padEnd(19, ' ');
  const reserved = ''.padEnd(6, ' ');
  const originatingDfiIdentification = batch.originatingDfiIdentification;
  const batchNumberField = batchNumber.toString().padStart(7, '0');

  const line =
    recordTypeCode +
    serviceClassCode +
    entryAddendaCount +
    entryHash +
    totalDebit +
    totalCredit +
    companyIdentification +
    messageAuthenticationCode +
    reserved +
    originatingDfiIdentification +
    batchNumberField;

  return line.padEnd(94, ' ');
}

/**
 * Formats the file control record (record type code 9).
 */
function formatFileControl(file: NachaFile): string {
  const recordTypeCode = '9';
  const batchCount = file.batches.length.toString().padStart(6, '0');
  const blockCount = '000001';
  const entryAddendaCount = file.batches
    .reduce((sum, batch) => sum + batch.entries.length, 0)
    .toString()
    .padStart(8, '0');

  const entryHashTotal = file.batches.reduce((fileSum, batch) => {
    const batchSum = batch.entries.reduce((sum, entry) => {
      const routing = entry.receivingDfiRoutingNumber;
      return sum + Number.parseInt(routing, 10);
    }, 0);
    return fileSum + batchSum;
  }, 0);

  const entryHash = entryHashTotal.toString().slice(-10).padStart(10, '0');

  const totalDebit = file.batches
    .flatMap((batch) => batch.entries)
    .filter((entry) => entry.transactionCode.toString().endsWith('7'))
    .reduce((sum, entry) => sum + entry.amountCents, 0)
    .toString()
    .padStart(12, '0');

  const totalCredit = file.batches
    .flatMap((batch) => batch.entries)
    .filter((entry) => entry.transactionCode.toString().endsWith('2'))
    .reduce((sum, entry) => sum + entry.amountCents, 0)
    .toString()
    .padStart(12, '0');

  const reserved = ''.padEnd(39, ' ');

  const line =
    recordTypeCode +
    batchCount +
    blockCount +
    entryAddendaCount +
    entryHash +
    totalDebit +
    totalCredit +
    reserved;

  return line.padEnd(94, ' ');
}

/**
 * Converts a high-level `NachaFile` description into a fully formatted NACHA file string.
 * Throws if validation fails so that only structurally valid files are emitted.
 */
export function serializeNachaFile(file: NachaFile): string {
  validateFile(file);

  const lines: string[] = [];
  lines.push(formatFileHeader(file));

  file.batches.forEach((batch, index) => {
    const batchNumber = index + 1;
    validateBatch(batch);
    lines.push(formatBatchHeader(batch, batchNumber));

    const tracePrefix = batch.originatingDfiIdentification;
    batch.entries.forEach((entry) => {
      lines.push(formatEntryDetail(entry, tracePrefix));
    });

    lines.push(formatBatchControl(batch, batchNumber));
  });

  lines.push(formatFileControl(file));

  return lines.join('\n');
}


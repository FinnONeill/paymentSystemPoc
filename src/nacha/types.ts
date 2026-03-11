/**
 * Core type definitions for the NACHA ACH file domain model.
 *
 * These interfaces are intentionally focused on the most common use cases
 * (e.g. PPD credit/debit batches), but the shapes are extensible so that
 * future developers can add additional record types or fields as needed.
 */

// Commonly used standard entry class codes.
export type StandardEntryClassCode = 'PPD' | 'CCD' | 'CTX';

// Supported account types for entries.
export type AccountType = 'CHECKING' | 'SAVINGS';

// NACHA service class codes (partial list, commonly used).
export enum ServiceClassCode {
  MixedDebitsAndCredits = 200,
  CreditsOnly = 220,
  DebitsOnly = 225,
}

// Transaction code values for checking and savings accounts (partial list).
export enum TransactionCode {
  CheckingCredit = 22,
  CheckingDebit = 27,
  SavingsCredit = 32,
  SavingsDebit = 37,
}

/**
 * Represents a single entry detail record within a batch.
 */
export interface NachaEntryDetail {
  readonly transactionCode: TransactionCode;
  readonly receivingDfiRoutingNumber: string;
  readonly receivingDfiCheckDigit: string;
  readonly dfiAccountNumber: string;
  readonly amountCents: number;
  readonly individualIdNumber?: string;
  readonly individualName: string;
  readonly discretionaryData?: string;
  readonly addendaRecordIndicator: 0 | 1;
  readonly traceNumber: string;
}

/**
 * Optional addenda record attached to an entry detail.
 * For simplicity this library supports a single addenda per entry.
 */
export interface NachaAddendaRecord {
  readonly entryDetailSequenceNumber: number;
  readonly paymentRelatedInformation: string;
}

/**
 * Represents a single batch within an ACH file.
 */
export interface NachaBatch {
  readonly serviceClassCode: ServiceClassCode;
  readonly companyName: string;
  readonly companyDiscretionaryData?: string;
  readonly companyIdentification: string;
  readonly standardEntryClassCode: StandardEntryClassCode;
  readonly companyEntryDescription: string;
  readonly companyDescriptiveDate?: string;
  readonly effectiveEntryDate: string;
  readonly originatingDfiIdentification: string;
  readonly batchNumber: number;
  readonly entries: ReadonlyArray<NachaEntryDetail>;
  readonly addendaRecords?: ReadonlyArray<NachaAddendaRecord>;
}

/**
 * Represents a complete NACHA file consisting of one or more batches.
 * This initial implementation supports multiple batches while keeping
 * the structure straightforward to extend for additional record types.
 */
export interface NachaFile {
  readonly immediateDestinationRoutingNumber: string;
  readonly immediateOriginRoutingNumber: string;
  readonly immediateDestinationName: string;
  readonly immediateOriginName: string;
  readonly fileCreationDate: string;
  readonly fileCreationTime?: string;
  readonly fileIdModifier: string;
  readonly referenceCode?: string;
  readonly batches: ReadonlyArray<NachaBatch>;
}


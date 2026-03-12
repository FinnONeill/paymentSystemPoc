### NACHA library

This folder contains a small, focused NACHA ACH file library plus a NestJS wrapper:

- **Pure library exports** (via `index.ts`)
  - Types from `types.ts`
  - Parsing from `parser.ts`
  - Validation from `validation.ts`
  - Formatting/serialization from `formatter.ts`
- **NestJS integration**
  - `NachaService` and `NachaController` for HTTP APIs

Use the pure functions for library usage inside other services, and the NestJS service/controller for HTTP endpoints.

---

### Core types (`types.ts`)

- **`StandardEntryClassCode`**: `'PPD' | 'CCD' | 'CTX'`
- **`AccountType`**: `'CHECKING' | 'SAVINGS'` (for modelling but not yet wired everywhere).
- **`ServiceClassCode` enum**
  - `MixedDebitsAndCredits = 200`
  - `CreditsOnly = 220`
  - `DebitsOnly = 225`
- **`TransactionCode` enum**
  - `CheckingCredit = 22`, `CheckingDebit = 27`, `SavingsCredit = 32`, `SavingsDebit = 37`
- **`NachaEntryDetail`**
  - Single entry detail record (type 6) with:
    - `transactionCode`, `receivingDfiRoutingNumber`, `receivingDfiCheckDigit`
    - `dfiAccountNumber`, `amountCents`
    - `individualIdNumber?`, `individualName`, `discretionaryData?`
    - `addendaRecordIndicator: 0 | 1`
    - `traceNumber`
    - optional `addenda?: NachaAddendaRecord`
- **`NachaAddendaRecord`**
  - Single addenda record (type 7) attached to an entry:
    - `addendaTypeCode`, `paymentRelatedInformation`, `addendaSequenceNumber`, `entryDetailSequenceNumber`
  - The library supports only **one** addenda per entry.
- **`NachaBatch`**
  - Batch header + entries:
    - `serviceClassCode`, `companyName`, `companyDiscretionaryData?`
    - `companyIdentification`, `standardEntryClassCode`, `companyEntryDescription`, `companyDescriptiveDate?`
    - `effectiveEntryDate`, optional `settlementDateJulian?`
    - `originatorStatusCode?`, `originatingDfiIdentification`, `batchNumber`
    - `entries: ReadonlyArray<NachaEntryDetail>`
- **`NachaFile`**
  - Top-level file:
    - `immediateDestinationRoutingNumber`, `immediateOriginRoutingNumber`
    - `immediateDestinationName`, `immediateOriginName`
    - `fileCreationDate`, optional `fileCreationTime?`
    - `fileIdModifier`, optional `referenceCode?`
    - `batches: ReadonlyArray<NachaBatch>`

**Naming conventions**

- Use:
  - `*File` for top‑level structures (`NachaFile`).
  - `*Batch` for batch‑level (`NachaBatch`).
  - `*EntryDetail` and `*AddendaRecord` for type 6/7 records.
  - `ServiceClassCode` and `TransactionCode` enums for NACHA numeric codes.
- Keep text fields UPPERCASE when serialized, to align with NACHA formatting and examples.

---

### Parsing (`parser.ts`)

**Purpose:** Convert a NACHA‐formatted text file into a validated `NachaFile` object.

- **`parseNachaFile(contents: string): NachaFile`**
  - Splits on newlines, drops blank lines.
  - Parses:
    - File header (type `1`) via `parseFileHeader`.
    - Batch headers (type `5`) via `parseBatchHeader`.
    - Entry details (type `6`) via `parseEntryDetail`.
    - Addenda (type `7`) via `parseAddendaRecord` attached to the most recent entry.
    - Batch controls (type `8`) and file control (type `9`) to complete parsing.
  - Assembles a full `NachaFile` object and passes it to `validateFile` before returning.

**Usage example**

```ts
import { parseNachaFile, NachaFile } from './nacha';

const contents = await fs.promises.readFile('sample.nacha', 'utf8');
const nachaFile: NachaFile = parseNachaFile(contents);

console.log(nachaFile.batches[0].entries.length);
```

**Notes**

- The parser will throw descriptive errors on:
  - Incorrect record types (e.g. file not starting with `1`).
  - Line length < 94 characters.
  - Misordered records (e.g. addenda before any entry).
  - Validation failures (`validateFile` and `validateBatch`).

---

### Validation (`validation.ts`)

**Purpose:** Validate routing numbers, entries, batches, and full files according to NACHA structural rules.

- **`isValidRoutingNumber(routingNumber: string): boolean`**
  - Pure ABA check‑digit validation.
  - Expects exactly 9 digits; returns `true` only when the weighted sum mod 10 equals 0.

- **`validateEntryDetail(entry: NachaEntryDetail): void`**
  - Throws if:
    - `transactionCode` is not in `TransactionCode`.
    - `receivingDfiRoutingNumber` is not 8 digits.
    - Combined routing/check digit fails `isValidRoutingNumber`.
    - `amountCents` is negative or exceeds allowed size.
    - `individualName` is blank.
    - `traceNumber` is not 15 digits.
    - `addendaRecordIndicator` and `addenda` presence conflict.

- **`validateBatch(batch: NachaBatch): void`**
  - Ensures:
    - Required text fields are non‑blank (company name, identification, description).
    - `standardEntryClassCode` is 3 uppercase letters.
    - `effectiveEntryDate` is `YYMMDD`.
    - `originatingDfiIdentification` is 8 digits.
    - `batchNumber` is within range.
    - At least one entry is present and each passes `validateEntryDetail`.

- **`validateFile(file: NachaFile): void`**
  - Validates:
    - Immediate destination/origin routing numbers are 10 characters (`leading space or 0 + 9 digits`).
    - Routing numbers pass `isValidRoutingNumber`.
    - Names are non‑blank.
    - `fileCreationDate` is `YYMMDD`; `fileCreationTime` (if present) is `HHMM`.
    - `fileIdModifier` is a single alphanumeric char.
    - At least one batch, and all batches pass `validateBatch`.

**Typical usage**

- Parser and serializer already call these for you:
  - `parseNachaFile` → `validateFile`
  - `serializeNachaFile` → `validateFile` and `validateBatch`
- Call them directly if you want to validate an object you constructed before serializing.

---

### Formatting / serialization (`formatter.ts`)

**Purpose:** Convert a `NachaFile` object into a fixed‑width NACHA string.

- **`serializeNachaFile(file: NachaFile): string`**
  - Validates the file and batches.
  - Builds:
    - File header (`formatFileHeader`, record type 1).
    - For each batch:
      - Batch header (`formatBatchHeader`, record type 5).
      - Entry detail records (`formatEntryDetail`, record type 6).
      - Addenda records when `entry.addenda` is present (`formatAddendaRecord`, record type 7).
      - Batch control (`formatBatchControl`, record type 8).
    - File control (`formatFileControl`, record type 9).
  - Joins lines with `\n` and returns the complete file.

**Usage example**

```ts
import {
  NachaFile,
  ServiceClassCode,
  TransactionCode,
  serializeNachaFile,
} from './nacha';

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
          amountCents: 10000,
          individualName: 'JOHN DOE',
          addendaRecordIndicator: 0,
          traceNumber: '011000010000001',
        },
      ],
    },
  ],
};

const nachaText = serializeNachaFile(file);
```

---

### NestJS service and controller

These are convenience layers over the core library.

- **`NachaService`**
  - `getSampleNachaFile(): string`
    - Returns an example file built via `buildSampleFile` and `serializeNachaFile`.
  - `serialize(file: NachaFile): string`
    - Simple wrapper over `serializeNachaFile`.
  - `parse(content: string): NachaFile`
    - Wrapper over `parseNachaFile`.
  - `validateRoutingNumber(routingNumber: string): { valid: boolean }`
    - Uses `isValidRoutingNumber`.
  - `validateFileContent(content: string): { valid: true; file: NachaFile } | { valid: false; error: string }`
    - Parses and catches any error, returning a structured result.

- **`NachaController` (HTTP endpoints)**
  - `GET /nacha/sample` → sample file as `text/plain`.
  - `POST /nacha/serialize` with JSON `NachaFile` body → NACHA text.
  - `POST /nacha/parse` with `{ content: string }` body → parsed `NachaFile` JSON.
  - `GET /nacha/validate/routing/:routingNumber` → `{ valid: boolean }`.
  - `POST /nacha/validate/file` with multipart `file` upload → validation result.

---

### Recommended usage patterns (playbook)

- **Pattern: Generate a NACHA file for outbound payments**
  - Build a `NachaFile` object in your domain layer:
    - Populate routing numbers with correct leading space/zero.
    - Use `ServiceClassCode` and `TransactionCode` enums.
    - Ensure `traceNumber` is unique within your originator.
  - Call `serializeNachaFile` and persist or send the resulting text.

- **Pattern: Intake and validate inbound NACHA files**
  - Read file contents as UTF‑8 text.
  - Call `parseNachaFile`:
    - Handle exceptions by logging the message and rejecting the file.
  - Work with the typed `NachaFile` to inspect batches, entries, and amounts.

- **Pattern: Validate routing numbers at user input**
  - Use `isValidRoutingNumber` to reject invalid ABA routing numbers early in UI/back‑end validation.

---

### Best practices

- **Field formatting**
  - Honour NACHA‐expected formats:
    - Routing numbers: space/zero + 9 digits in file header; 8 digits + check digit for entries.
    - Dates: `YYMMDD` (file creation, effective entry).
    - Times: `HHMM`.
  - Keep text fields uppercase and avoid special characters that could break NACHA processors.

- **Validation before serialization**
  - Always let `serializeNachaFile` run validation instead of bypassing it.
  - When constructing `NachaFile` by hand, consider calling `validateFile` explicitly during testing.

- **Immutability**
  - Treat `NachaFile`, `NachaBatch`, and `NachaEntryDetail` as immutable value objects:
    - Prefer building new objects rather than mutating in place.
    - This keeps it easier to reason about and test.

- **Error handling**
  - Wrap `parseNachaFile` in try/catch and surface human‑readable messages to operators.
  - Log the failing line/record type when possible (without exposing sensitive data).

---

### Common mistakes and how to avoid them

- **Invalid routing numbers**
  - Symptom: `... routing number failed check digit validation`.
  - Fix:
    - Ensure the 9‑digit routing number is correct and passes `isValidRoutingNumber`.
    - When populating file header fields, include the leading space/zero as required.

- **Incorrect line lengths**
  - Symptom: `record must be 94 characters` errors when parsing.
  - Fix:
    - Do not trim lines when reading from disk.
    - Use `serializeNachaFile` instead of hand‑crafting lines.

- **Missing or inconsistent addenda**
  - Symptom: Errors about addenda indicator vs addenda presence.
  - Fix:
    - When `addendaRecordIndicator === 1`, supply an `addenda` object.
    - When `addendaRecordIndicator === 0`, omit `addenda`.

- **Empty batches or files**
  - Symptom: `Batch must contain at least one entry` or `File must contain at least one batch`.
  - Fix:
    - Ensure you always add at least one entry to each batch.
    - Do not attempt to serialize or parse “empty” placeholder files.


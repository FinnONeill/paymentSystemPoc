import { Injectable } from '@nestjs/common';
import {
  NachaFile,
  parseNachaFile,
  serializeNachaFile,
  ServiceClassCode,
  TransactionCode,
  isValidRoutingNumber,
} from './index';

@Injectable()
export class NachaService {
  /**
   * Returns a sample NACHA file as raw text for testing.
   */
  getSampleNachaFile(): string {
    return serializeNachaFile(this.buildSampleFile());
  }

  /**
   * Serializes a NachaFile JSON payload into NACHA-formatted text.
   */
  serialize(file: NachaFile): string {
    return serializeNachaFile(file);
  }

  /**
   * Parses NACHA-formatted text into a NachaFile object.
   */
  parse(content: string): NachaFile {
    return parseNachaFile(content);
  }

  /**
   * Validates a routing number (9 digits, passes check digit).
   */
  validateRoutingNumber(routingNumber: string): { valid: boolean } {
    return { valid: isValidRoutingNumber(routingNumber) };
  }

  private buildSampleFile(): NachaFile {
    return {
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
  }
}

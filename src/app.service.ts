import { Injectable } from '@nestjs/common';
import {
  serializeNachaFile,
  ServiceClassCode,
  TransactionCode,
} from './nacha';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Example method that proves the NACHA library is wired into the Nest layer.
   * This keeps the library reusable while still exercising it in the app.
   */
  generateSampleNachaFile(): string {
    return serializeNachaFile({
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
    });
  }
}

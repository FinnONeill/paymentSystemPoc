<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Strongly typed, reusable NACHA ACH file library implemented in TypeScript and exposed from the `src/nacha` module. It supports creating and parsing NACHA files with validation and is designed to be easily extended by future developers.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests (includes NACHA library)
$ npm run test

# NACHA library coverage report
$ npm run test:cov
```

## NACHA library usage

The NACHA library lives under `src/nacha` and is exported via `src/nacha/index.ts`.

- **Create a file**: build a `NachaFile` object and pass it to `serializeNachaFile` to obtain a 94-character-line NACHA string.
- **Parse a file**: pass an existing NACHA file string to `parseNachaFile` to receive a strongly typed `NachaFile` instance.
- **Validate**: call `validateFile`, `validateBatch`, or `validateEntryDetail` directly when you want granular validation errors before serialization.

Example (inside any Nest provider or standalone script):

```ts
import {
  serializeNachaFile,
  parseNachaFile,
  ServiceClassCode,
  TransactionCode,
  NachaFile,
} from './nacha';

const file: NachaFile = {
  immediateDestinationRoutingNumber: '0011000015',
  immediateOriginRoutingNumber: '0011000015',
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
          receivingDfiRoutingNumber: '01100001',
          receivingDfiCheckDigit: '5',
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

const nachaText = serializeNachaFile(file);
const parsedBack = parseNachaFile(nachaText);
```

The implementation focuses on the most common record types (file header, batch header, entry detail, batch control, file control) and enforces field lengths, numeric formats, and routing number validity. Additional record types and validation rules can be added by extending `src/nacha/types.ts` and updating the formatter/parser accordingly.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

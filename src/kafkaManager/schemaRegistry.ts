import {
  GlueClient,
  GetSchemaVersionCommand,
  RegisterSchemaVersionCommand,
  SchemaVersionStatus,
} from '@aws-sdk/client-glue';
import {
  AvroSchemaDefinition,
  GlueSchemaRegistryConfig,
  SchemaValidationResult,
} from './types';

export class GlueSchemaRegistry {
  private readonly client: GlueClient;
  private readonly config: GlueSchemaRegistryConfig;

  constructor(config: GlueSchemaRegistryConfig, client?: GlueClient) {
    this.config = config;
    this.client = client ?? new GlueClient({ region: config.region });
  }

  async validateOrRegisterSchema(schema: AvroSchemaDefinition): Promise<SchemaValidationResult> {
    const schemaDefinition = JSON.stringify(schema);

    const registerResult = await this.client.send(
      new RegisterSchemaVersionCommand({
        SchemaId: {
          RegistryName: this.config.registryName,
          SchemaName: this.config.schemaName,
        },
        SchemaDefinition: schemaDefinition,
      }),
    );

    const { SchemaVersionId, SchemaArn, Status } = registerResult as {
      SchemaVersionId?: string;
      SchemaArn?: string;
      Status?: SchemaVersionStatus;
    };

    if (!SchemaVersionId || !SchemaArn) {
      throw new Error('Glue schema registry did not return required identifiers.');
    }

    if (Status && Status !== SchemaVersionStatus.AVAILABLE) {
      throw new Error(`Schema version status is not compatible for use: ${Status}`);
    }

    const version = await this.client.send(
      new GetSchemaVersionCommand({
        SchemaVersionId,
      }),
    );

    if (!version.SchemaDefinition) {
      throw new Error('Glue schema registry returned an empty schema definition.');
    }

    if (version.SchemaDefinition !== schemaDefinition) {
      throw new Error('Local Avro schema does not match Glue schema registry definition.');
    }

    return {
      isCompatible: true,
      schemaArn: SchemaArn,
      versionId: SchemaVersionId,
    };
  }
}


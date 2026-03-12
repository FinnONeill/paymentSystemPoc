import { GlueSchemaRegistry } from './schemaRegistry';
import { AvroSchemaDefinition, GlueSchemaRegistryConfig } from './types';
import {
  GlueClient,
  GetSchemaVersionCommand,
  RegisterSchemaVersionCommand,
  SchemaVersionStatus,
} from '@aws-sdk/client-glue';

jest.mock('@aws-sdk/client-glue');

const schema: AvroSchemaDefinition = {
  type: 'record',
  name: 'TestRecord',
  fields: [
    {
      name: 'id',
      type: 'string',
    },
  ],
};

const config: GlueSchemaRegistryConfig = {
  region: 'eu-west-1',
  registryName: 'test-registry',
  schemaName: 'test-schema',
};

describe('GlueSchemaRegistry', () => {
  it('validates schema and returns identifiers', async () => {
    const client = new GlueClient({});
    const sendMock = jest.fn()
      .mockResolvedValueOnce({
        SchemaVersionId: 'version-1',
        SchemaArn: 'arn:aws:glue:region:account:schema/test',
        Status: SchemaVersionStatus.AVAILABLE,
      })
      .mockResolvedValueOnce({
        SchemaDefinition: JSON.stringify(schema),
      });

    (client.send as unknown as jest.Mock).mockImplementation(sendMock);

    const registry = new GlueSchemaRegistry(config, client);

    const result = await registry.validateOrRegisterSchema(schema);

    expect(result.isCompatible).toBe(true);
    expect(result.schemaArn).toContain('arn:aws:glue');
    expect(result.versionId).toBe('version-1');
    expect(RegisterSchemaVersionCommand).toHaveBeenCalled();
    expect(GetSchemaVersionCommand).toHaveBeenCalled();
  });

  it('throws when Glue does not return identifiers', async () => {
    const client = new GlueClient({});
    const sendMock = jest
      .fn()
      .mockResolvedValueOnce({
        SchemaVersionId: undefined,
        SchemaArn: undefined,
      })
      .mockResolvedValueOnce({
        SchemaDefinition: JSON.stringify(schema),
      });

    (client.send as unknown as jest.Mock).mockImplementation(sendMock);

    const registry = new GlueSchemaRegistry(config, client);

    await expect(registry.validateOrRegisterSchema(schema)).rejects.toThrow(
      /did not return required identifiers/i,
    );
  });

  it('throws when schema status is not AVAILABLE', async () => {
    const client = new GlueClient({});
    const sendMock = jest
      .fn()
      .mockResolvedValueOnce({
        SchemaVersionId: 'version-1',
        SchemaArn: 'arn:aws:glue:region:account:schema/test',
        Status: 'INCOMPATIBLE',
      })
      .mockResolvedValueOnce({
        SchemaDefinition: JSON.stringify(schema),
      });

    (client.send as unknown as jest.Mock).mockImplementation(sendMock);

    const registry = new GlueSchemaRegistry(config, client);

    await expect(registry.validateOrRegisterSchema(schema)).rejects.toThrow(
      /status is not compatible/i,
    );
  });

  it('throws when Glue returns an empty schema definition', async () => {
    const client = new GlueClient({});
    const sendMock = jest
      .fn()
      .mockResolvedValueOnce({
        SchemaVersionId: 'version-1',
        SchemaArn: 'arn:aws:glue:region:account:schema/test',
        Status: SchemaVersionStatus.AVAILABLE,
      })
      .mockResolvedValueOnce({
        SchemaDefinition: undefined,
      });

    (client.send as unknown as jest.Mock).mockImplementation(sendMock);

    const registry = new GlueSchemaRegistry(config, client);

    await expect(registry.validateOrRegisterSchema(schema)).rejects.toThrow(
      /returned an empty schema definition/i,
    );
  });

  it('throws when local schema does not match Glue definition', async () => {
    const client = new GlueClient({});
    const sendMock = jest
      .fn()
      .mockResolvedValueOnce({
        SchemaVersionId: 'version-1',
        SchemaArn: 'arn:aws:glue:region:account:schema/test',
        Status: SchemaVersionStatus.AVAILABLE,
      })
      .mockResolvedValueOnce({
        SchemaDefinition: JSON.stringify({ ...schema, name: 'Different' }),
      });

    (client.send as unknown as jest.Mock).mockImplementation(sendMock);

    const registry = new GlueSchemaRegistry(config, client);

    await expect(registry.validateOrRegisterSchema(schema)).rejects.toThrow(
      /does not match Glue schema registry definition/i,
    );
  });
});


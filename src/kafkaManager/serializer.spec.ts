import { AvroSerializer } from './serializer';
import { AvroSchemaDefinition } from './types';

interface TestPayload {
  id: string;
}

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

describe('AvroSerializer', () => {
  it('serializes and deserializes payloads symmetrically', () => {
    const serializer = new AvroSerializer<TestPayload>(schema);
    const payload: TestPayload = { id: '123' };

    const buffer = serializer.serialize({
      payload,
      schema,
    });

    const result = serializer.deserialize({
      buffer,
      schema,
    });

    expect(result).toEqual(payload);
  });
});


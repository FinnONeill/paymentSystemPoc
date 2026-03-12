import { Type as AvroType } from 'avsc';
import {
  AvroSchemaDefinition,
  DeserializationContext,
  SerializationContext,
} from './types';

export class AvroSerializer<TPayload> {
  private readonly avroType: AvroType;

  constructor(schema: AvroSchemaDefinition) {
    this.avroType = AvroType.forSchema(schema, {
      noAnonymousTypes: true,
    });
  }

  serialize(context: SerializationContext<TPayload>): Buffer {
    return this.avroType.toBuffer(context.payload);
  }

  deserialize(context: DeserializationContext<TPayload>): TPayload {
    const value = this.avroType.fromBuffer(context.buffer) as TPayload;
    return value;
  }
}


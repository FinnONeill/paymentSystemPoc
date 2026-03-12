### Kafka Manager library

This folder contains a small Kafka + AWS Glue Schema Registry integration layer built around Avro. It is intended to be used both directly (via the exported classes/functions) and indirectly through NestJS services.

Exports are re‑exported from `index.ts`.

- **Core classes**
  - `KafkaManager<TPayload>` from `kafkaManager.ts`
  - `GlueSchemaRegistry` from `schemaRegistry.ts`
  - `AvroSerializer<TPayload>` from `serializer.ts`
- **Core types**
  - `KafkaManagerOptions`, `KafkaProducerRecord<TPayload>`, `KafkaConsumerMessage<TPayload>`
  - `AvroSchemaDefinition` and related schema/connection config types

---

### KafkaManager<TPayload>

**Purpose:** High-level façade that:

- Ensures the Avro schema is registered and compatible in AWS Glue.
- Produces Avro‑encoded messages to Kafka.
- Consumes Avro‑encoded messages from Kafka and hands deserialized payloads to your handler.

**Constructor**

```ts
new KafkaManager<TPayload>(options: KafkaManagerOptions, schema: AvroSchemaDefinition)
```

- **`options.connection`**: Kafka connection (`clientId`, `brokers`, optional `ssl`, `sasl`).
- **`options.topicConfig`**: Topic configuration (at minimum `topic`).
- **`options.glueConfig`**: AWS Glue Schema Registry config (`region`, `registryName`, `schemaName`).
- **`schema`**: Avro record definition matching `TPayload`.

**Methods**

- **`ensureSchemaCompatibility(): Promise<void>`**
  - Registers the Avro schema in Glue (if needed) and verifies the stored schema definition exactly matches the local one.
  - Throws if Glue returns a non‑available status or the definitions differ.

- **`produce(record: KafkaProducerRecord<TPayload>): Promise<void>`**
  - Ensures schema compatibility, then:
    - Creates a KafkaJS producer.
    - Serializes `record.value` using the configured Avro schema.
    - Sends a single message to `record.topic` with optional `key` and `headers`.
  - Always disconnects the producer in a `finally` block.

- **`consume(groupId: string, handler: (message: KafkaConsumerMessage<TPayload>) => Promise<void>): Promise<void>`**
  - Ensures schema compatibility, then:
    - Creates and connects a KafkaJS consumer with the given `groupId`.
    - Subscribes to `options.topicConfig.topic`.
    - Runs a loop with `eachMessage`:
      - Skips records with empty `message.value`.
      - Deserializes `message.value` using the Avro schema.
      - Normalizes headers to `Record<string, string>` (supports buffer or string headers).
      - Invokes your `handler` with a `KafkaConsumerMessage<TPayload>`.

**Minimal usage example**

```ts
import { KafkaManager, AvroSchemaDefinition, KafkaManagerOptions } from './kafkaManager';

interface UserCreatedPayload {
  id: string;
  email: string;
}

const userCreatedSchema: AvroSchemaDefinition = {
  type: 'record',
  name: 'UserCreated',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'email', type: 'string' },
  ],
};

const options: KafkaManagerOptions = {
  connection: {
    clientId: 'my-service',
    brokers: ['localhost:9092'],
    ssl: false,
  },
  topicConfig: { topic: 'user-created' },
  glueConfig: {
    region: 'eu-west-1',
    registryName: 'my-registry',
    schemaName: 'user-created-schema',
  },
};

const manager = new KafkaManager<UserCreatedPayload>(options, userCreatedSchema);

await manager.produce({
  topic: 'user-created',
  key: 'user-123',
  value: { id: 'user-123', email: 'user@example.com' },
});
```

---

### GlueSchemaRegistry

**Purpose:** Thin wrapper around `@aws-sdk/client-glue` that registers and validates Avro schemas.

**Constructor**

```ts
new GlueSchemaRegistry(config: GlueSchemaRegistryConfig, client?: GlueClient)
```

- `config.region`, `config.registryName`, `config.schemaName`
- Optional `client` for dependency injection/testing.

**Key method**

- **`validateOrRegisterSchema(schema: AvroSchemaDefinition): Promise<SchemaValidationResult>`**
  - JSON stringifies the schema and calls `RegisterSchemaVersionCommand`.
  - Verifies Glue returned a `SchemaVersionId` and `SchemaArn`.
  - Fails if `Status` is not `AVAILABLE`.
  - Retrieves the newly registered version via `GetSchemaVersionCommand` and ensures the definition matches exactly.

Use this directly if you want lower‑level control than `KafkaManager` provides, e.g. validating schemas at startup in a separate process.

---

### AvroSerializer<TPayload>

**Purpose:** Encapsulates an `avsc` `Type` for a specific Avro record schema and provides strongly typed helpers.

**Constructor**

```ts
new AvroSerializer<TPayload>(schema: AvroSchemaDefinition)
```

**Methods**

- **`serialize(context: SerializationContext<TPayload>): Buffer`**
  - Expects `context.payload: TPayload` and the matching `schema`.
  - Returns a Node `Buffer` with Avro‑encoded bytes.

- **`deserialize(context: DeserializationContext<TPayload>): TPayload`**
  - Expects `context.buffer` and matching `schema`.
  - Returns the decoded payload.

You usually do not need to use this directly if you’re working through `KafkaManager`, but it is available when you need serialization outside Kafka (e.g. persisting Avro blobs).

---

### Types and naming conventions

- **Schemas**
  - Use `SomethingEvent` or `SomethingRecord` for `AvroSchemaDefinition.name`.
  - Keep field names in `camelCase` and align with your `TPayload` interface.
  - Store schemas close to the payload type definition (e.g. `userEvent.schema.ts`).

- **Topics and records**
  - Use `KafkaProducerRecord<T>` for outgoing messages:
    - `topic`: the Kafka topic name.
    - `key`: partitioning key (string), recommended: `entity-type:id` (e.g. `user:123`).
    - `headers`: HTTP‑style string headers for trace IDs, correlation IDs, etc.
  - Use `KafkaConsumerMessage<T>` in consumer handlers.

- **Options / configuration**
  - `KafkaManagerOptions`
    - Prefer environment variables for `brokers`, `clientId`, and Glue settings.
    - Keep a single source of truth for topic names (e.g. `kafka-topics.ts`).

---

### Recommended usage patterns (playbook)

- **Pattern: Single‑topic producer**
  - Create one `KafkaManager<T>` per logical event stream/topic.
  - Instantiate at application startup and reuse for the life of the process.
  - Call `produce` for each message; let `KafkaManager` handle schema validation.

- **Pattern: Consumer worker**
  - Use `consume(groupId, handler)` in long‑running workers or NestJS providers.
  - Ensure your `handler`:
    - Is idempotent (messages may be redelivered).
    - Handles transient errors (wrap in retries if necessary).
  - Run one consumer per consumer group per service, then scale horizontally.

- **Pattern: Schema validation as a deployment gate**
  - At startup or as part of CI/CD:
    - Instantiate `KafkaManager` or `GlueSchemaRegistry`.
    - Call `ensureSchemaCompatibility` / `validateOrRegisterSchema`.
  - Fail fast if the schema is incompatible instead of discovering this at runtime.

---

### Best practices

- **Schema discipline**
  - Treat Avro schemas as versioned contracts.
  - Avoid “any”/loosely typed fields in payload interfaces; keep them consistent with your Avro definition.
  - Use backwards‑compatible changes: add optional fields instead of removing or changing types.

- **Error handling**
  - Wrap `produce` and `consume` calls with logging and metrics.
  - On consumer side, log enough context (topic, key, partition, offset) to replay or triage failures.

- **Resource management**
  - `KafkaManager.produce` connects and disconnects a producer per call.
    - For very high throughput, consider a dedicated producer abstraction that reuses connections and use `AvroSerializer` directly.

- **Testing**
  - Inject `GlueClient` and Kafka clients (via `KafkaManagerService` or your own wrapper) so you can unit‑test without real AWS/Kafka.
  - Use lightweight Avro schemas in tests to keep them readable.

---

### Common mistakes and how to avoid them

- **Schema mismatch with Glue**
  - Symptom: `Local Avro schema does not match Glue schema registry definition.`
  - Fix:
    - Ensure you have not modified the local schema without bumping/aligning the Glue schema.
    - Use a single codebase or migration flow to update both.

- **Incorrect brokers or authentication**
  - Symptom: connection errors from Kafka when calling `produce` or `consume`.
  - Fix:
    - Double‑check `KafkaManagerOptions.connection.brokers` is a non‑empty array of `host:port`.
    - Ensure `ssl` and `sasl` align with your cluster configuration.

- **Headers not deserializing as expected**
  - Symptom: missing or garbled headers in consumer messages.
  - Fix:
    - Only use string or Buffer values in KafkaJS headers; other types are ignored.
    - Expect all headers in `KafkaConsumerMessage` as strings (buffers are converted using UTF‑8).

- **Non‑deterministic payload shape**
  - Symptom: runtime Avro serialization errors.
  - Fix:
    - Keep `TPayload` strictly aligned with the Avro `fields` definition.
    - Avoid spreading arbitrary objects into payloads; validate payloads before producing.


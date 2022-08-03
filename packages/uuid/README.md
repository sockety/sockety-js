# @sockety/uuid - fast UUID v4 as buffers and strings

## Description

This package is meant to handle UUIDs in the [Sockety](https://www.npmjs.com/package/sockety) library. It's ultra-fast, and aims into simple and fast integration with buffers and strings.

## Installation

You may install this package from [NPM repository](https://www.npmjs.com/package/@sockety/uuid), via `npm install @sockety/uuid` or `yarn add @sockety/uuid`.

## Usage

```js
import { generateUuid, isValidUuidString, isValidUuidBuffer, readUuidToString, readUuid } from '@sockety/uuid';

// Generate new UUID object
const uuidInstance = generate();

// Build string representation
const uuidString = uuidInstance.toString();

// Write it to buffer
const buffer = Buffer.alloc(16);
uuidInstance.write(buffer);

// You may write it in the middle of the buffer too:
// const buffer = Buffer.alloc(36);
// uuidInstance.write(buffer, 10); (10,26)

// Read it from buffer
const uuidInstanceFromBuffer = readUuid(buffer);
const uuidStringFromBuffer = readUuidToString(buffer);

// You may read it from middle of the buffer too:
// const uuidInstanceFromBuffer = readUuid(buffer, 10);
// const uuidStringFromBuffer = readUuidToString(buffer, 10);

// Validate the UUID
isValidUuidString(uuidString); // true
isValidUuidString(uuidStringFromBuffer); // true
isValidUuidBuffer(buffer); // true

// You may validate the UUID in the middle of the buffer too:
// isValidUuidString(uuidStringFromBuffer, 10);
```

## Alternatives

Most of the time you should be fine with native [`crypto.randomUUID`](https://nodejs.org/api/crypto.html#cryptorandomuuidoptions) in Node.js.

Unless you're not working with buffers, it may be not worth to use `@sockety/uuid` as another extra dependency.

This `@sockety/uuid` package will use only 16 bytes to store UUID, as it's using its binary representation.
Using `buffer.write(crypto.randomUUID())` will use 36 bytes, as it will store string representation in the buffer.

## Benchmarks

Benchmarks ran internally, to compare the difference.

Generally, it has similar speed for generating UUIDs as `crypto.randomUUID`, but is much faster with handling buffers.
Additionally, it's using fewer bytes in the buffer then.

| Description                        | `crypto.randomUUID`   | `@sockety/uuid`                  |
|------------------------------------|-----------------------|----------------------------------|
| Generate UUID string               | `13,787,701 ops/s`    | `14,285,222 ops/s` (0.1x faster) |
| Generate UUID buffer               | `2,002,230 ops/s`     | `10,485,028 ops/s` (5.2x faster) |
| Generate UUID to existing buffer   | `2,325,965 ops/s`     | `20,427,191 ops/s` (8.7x faster) |
| Read UUID string from buffer       | `8,173,617 ops/s`     | `26,221,765 ops/s` (3.2x faster) |
| Read UUID string from buffer slice | `5,171,186 ops/s`     | `29,517,143 ops/s` (5.7x faster) |

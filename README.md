# Sockety - JS implementation

[**Sockety**](https://github.com/sockety/protocol) is lightweight and fast protocol.
This mono-repository is prepared for its JS implementation  - [**sockety** package](packages/sockety), along will all its dependencies:

* [`@sockety/uuid`](packages/uuid): fast UUID generator, with support for operating on raw buffers
* [`@sockety/buffers`](packages/buffers): builder for ultra fast buffer parsing, with support for streamed buffers
* [`@sockety/benchmark`](packages/benchmark): benchmark to compare Sockety performance with other solutions
* [`@sockety/core`](packages/core): internals for parsing and writing messages
* [`examples`](packages/examples): place for Sockety usage examples

## Benchmark

To run benchmark, simply run `npm run benchmark` command.

![Benchmark](./assets/benchmark.png)

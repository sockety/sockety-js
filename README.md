# Sockety - JS implementation

> **Note:** treat it as an experiment. Sockety is not used in production yet.
> It has really nice performance, but there is no dedicated tooling for it.
> Because of that, HTTP/2 and gRPC may behave better in most of the cases - it will be easier to load balance, secure and monitor it,
> as you will have tools in front of it that will do it transparently.
>
> It may be useful, when either (1) it's direct internal communication where performance would be most important, or (2) you would not use standard protocol anyway.

[**Sockety**](https://github.com/sockety/protocol) is lightweight and fast protocol.
This mono-repository is prepared for its JS implementation  - [**sockety** package](packages/sockety), along will all its dependencies:

* [`@sockety/uuid`](packages/uuid): fast UUID generator, with support for operating on raw buffers
* [`@sockety/buffers`](packages/buffers): builder for ultra fast buffer parsing, with support for streamed buffers
* [`@sockety/benchmark`](packages/benchmark): benchmark to compare Sockety performance with other solutions
* [`@sockety/core`](packages/core): internals for parsing and writing messages
* [`examples`](packages/examples): place for Sockety usage examples

## Benchmark

To run benchmark, simply run `npm run benchmark` command. In general, Sockety seems to work 3-15x faster than HTTP/2.

![Benchmark](./assets/benchmark.png)

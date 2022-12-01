# Sockety - blazing fast communication protocol

This library is a simple and fast client/server implementation for the [**Sockety** protocol](https://github.com/sockety/protocol).
It works over TCP, either directly or secured with TLS.

* [Installation](#installation)
* [Protocol](#protocol)
  * [Features](#features)
* [Usage](#usage)
  * [Running server](#running-server)
    * [MessageHandler helper](#messagehandler-helper)
    * [Secure server over TLS](#secure-server-over-tls)
  * [Connecting to server](#connecting-to-server)
  * [Streams](#streams)
  * [Files](#files)
  * [Examples](#examples)
* [Benchmark](#benchmark)
  * [Results](#results)
    * [Local connection](#local-connection)
    * [Remote connection](#remote-connection)

## Installation

The Sockety library expects Node v18+. The project is written in TypeScript, so the TS definitions will be available immediately after installation.

To install it in your project simply run: `yarn add sockety` or `npm install sockety`.

## Protocol

The Sockety is lightweight protocol, that limits the overhead of headers. It's meant to be flexible, so there are many ways to use it.
It's blazing fast, both because the protocol itself is fast in mind, and because the implementation is focused on that too.

### Features

It supports multiple different features:

* Send lightweight instructions
* Send messages with:
   * data (i.e. with [Msgpack](https://www.npmjs.com/package/msgpackr))
   * files
   * real-time stream
* Leave message with no response, or send 1 on more responses
   * For faster implementation, you may return a simple integer code too
* UUIDs (v4) are always available for every message and response
* Multiplexing - many concurrent messages/channels on single connection

Despite it has all required features, it's really fast - compared to native Node.js implementation of HTTP/2, **Sockety is always at least few times faster, and happens to be even 10-20x faster in different situations**.

## Usage

The Sockety library is pretty simple to use. Both server and client have mostly options inherited from `net.Socket` or `tls.TLSSocket`.

### Running server

To run the server, you should simply start it, and watch for messages/errors for every connection.

```ts
import { createServer, FastReply, ResponseDraft } from 'sockety';

// Instantiate server
const server = createServer();

// Prepare responses schema
const pong = new ResponseDraft().msgpack<string>();

// Handle connections
server.on('connection', connection => {
  connection.on('message', async message => {
      console.log(`Received "${message.action}" message: ${message.id}`);

      if (message.action === 'log') {
          console.log(`[Log Request] ${await message.msgpack()}`);
          await message.fastReply(FastReply.Accept);
      } else if (message.action === 'ping') {
          const request = message.respond(pong({ data: 'pong' }));
          await request.sent();
      } else {
          await message.fastReply(FastReply.NotImplemented);
      }
  });
  
  connection.on('error', error => {
      console.error(`Error: ${error}`);
  });
});

// Start listening
server.listen(9000).then(() => console.log(`Server started at port 9000`));
```

#### MessageHandler helper

Alternatively, you may use `MessageHandler` for building `message` event handlers. It simplifies the code a little, and has some optimizations applied - i.e. it will not send the fast reply, when the response is not read by client anyway.

It is working for client too.

```ts
import { createServer, MessageHandler, FastReply, ResponseDraft } from 'sockety';

// Instantiate server
const server = createServer();

// Prepare responses schema
const pong = new ResponseDraft().msgpack<string>();

// Prepare message handler
const handle = new MessageHandler()
    .use(message => {
        console.log(`Received "${message.action}" message: ${message.id}`);
    })
    .action('log', async message => {
        console.log(`[Log Request] ${await message.msgpack()}`);
        return FastReply.Accept;
    })
    .action('ping', async message => {
        const request = message.respond(pong({ data: 'pong' }));
        await request.sent();
    })
    .error(() => FastReply.InternalError)
    .use(() => FastReply.NotImplemented);

// Handle connections
server.on('connection', connection => {
  connection.on('message', handle);
  connection.on('error', error => {
      console.error(`Error: ${error}`);
  });
});

// Start listening
server.listen(9000).then(() => console.log(`Server started at port 9000`));
```

#### Secure server over TLS

To run server over TLS, use `createSecureServer` instead of `createServer`, and pass the options as per [`tls.createServer`](https://nodejs.org/api/tls.html#tlscreateserveroptions-secureconnectionlistener):

```ts
import { createSecureServer, MessageHandler, FastReply } from 'sockety';

// Instantiate server
const server = createSecureServer({
    cert: process.env.CERTIFICATE,
    key: process.env.PRIVATE_KEY,
});

// [...]
```

### Connecting to server

To connect to server, use `connect` or `secureConnect` functions.

```ts
import { connect, Draft, FastReply } from 'sockety';

// Prepare draft messages structure
const log = Draft.for('log').msgpack<string>();
const ping = Draft.for('ping');

// Initialize connection
const client = connect(9000);

// Read messages
// client.on('message', async message => {});

// Handle errors & connection closed
client.on('error', (error) => console.error(`Error: ${error}`));
client.on('close', () => console.log('Connection has been closed'));

// Wait for connection, and send some messages
client.ready().then(async () => {
    // Send instruction and don't expect any response
    await client.pass(log({ data: 'some text' }));
    
    // Send a message and wait for the (fast reply) response
    const response1 = await client.send(log({ data: 'some text' })).response();
    if (response1 !== FastReply.Accept) {
        throw new Error('For some reason the reply is invalid.');
    }
    
    // Send a message and read full response
    const response2 = await client.send(ping()).response();
    console.log((await response2.dataBuffer()).toString()); // "pong"
});
```

### Streams

As an example, you may send a message that will echo data in response:

```ts
/**
 * ***** Server ******
 */
import { createReadStream } from 'node:fs';
import { createServer } from 'sockety';

const draft = Draft.for('something').stream();

const server = createServer();
server.on('connection', async connection => {
  const request = connection.send(draft());
  const response = await request.response();
  
  // Log all data sent from the client
  response.stream.on('data', (x) => console.log(`[Server] Received: ${x}`));
  response.stream.on('finish', () => console.log(`[Server] Stream from the other side ended!`));
  request.stream.on('finish', () => console.log(`[Server] Own stream ended!`));
  
  // Send data to the client
  request.stream.write('some-text');
  request.stream.write('other-text');
  request.stream.write('anything-else');
  createReadStream('/etc/hosts').pipe(request.stream);
  // Fs.ReadStream will end the whole stream with piping.
  // If this is not desired, you may pass 2nd argument to pipe - { end: false }
});
server.listen(9000);

/**
 * ***** Client ******
 */
import { connect } from 'sockety';

const client = connect(9000);
client.on('message', async message => {
  const response = request.respond({}, true);
  await response.sent();

  // Log all data sent from the client
  message.stream.on('data', (x) => console.log(`[Client] Received: ${x}`));
  message.stream.on('finish', () => console.log(`[Client] Stream from the other side ended!`));
  response.stream.on('finish', () => console.log(`[Client] Own stream ended!`));

  // Send data to the client
  response.stream.write('some-text-from-client');
  response.stream.write('other-text-from-client');
  response.stream.write('anything-else-from-client');
  response.stream.end();
});
```

### Files

As an example, you may pass some files in a message, and write them immediately to the file system:

```ts
/**
 * ***** Server ******
 */
import { readFileSync, createReadStream, statSync } from 'node:fs';
import { createServer, FileTransfer } from 'sockety';

const draft = Draft.for('something').files();
const file1 = Buffer.from('there is some text');

const server = createServer();
server.on('connection', async connection => {
  // If the "files" are always the same, files() in draft could take that
  connection.pass(draft({
    files: [
      // Static file
      FileTransfer.buffer(file1, 'file-1.txt'),
      // File streamed from FS
      await FileTransfer.fs('/etc/hosts'),
    ],
  }));
});
server.listen(9000);

/**
 * ***** Client ******
 */
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { connect } from 'sockety';

const uploadPath = '/tmp';
const client = connect(9000);
client.on('message', message => {
  for (const file of message.files()) {
    const outputPath = join(uploadPath, file.name);
    file.pipe(createWriteStream(outputPath));
  }
});
```

### Examples

You may look at examples in this repository in [`packages/examples`](https://github.com/sockety/sockety-js/tree/main/packages/examples) directory.

* [**Chat**](https://github.com/sockety/sockety-js/tree/main/packages/examples/chat) - real-time chat example

## Benchmark

To run benchmarking on your machines, see [`benchmark`](https://github.com/sockety/sockety-js/tree/main/packages/benchmark) package.

Benchmarks are prepared to compare HTTP/1, HTTP/2, [Moleculer](https://moleculer.services/) and Sockety performance.

### Results

The tests were run with DigitalOcean droplets to keep it more real.

Locally, on MacBook Pro machine, I got far better results, but less stable.

#### Local connection

* The machine was **Basic Droplet » Premium Intel » 4vCPU / 8 GB RAM** from [DigitalOcean](https://www.digitalocean.com/pricing/droplets).

```
$ node benchmark -c 2 -cc 300 -w 1s -t 3s -e tls -e https/1 -e https/2
  Node version: 19.2.0
    V8 version: 10.8.168.20-node.8
Server workers: 1
Client workers: 2
   Connections: 2 × 2 (4)
   Concurrency: 2 × 300 (600)
      Duration: 3,000ms
  Warming time: 1,000ms

 HTTP/1                                                                                                 CPU%/client       CPU%/server 
                                      success           QPS          min          avg          max     usr  sys  u+s     usr  sys  u+s
 Short response (status code)         100.00%        18,991       7.19ms      31.59ms     186.91ms     87%  16% 103%     52%  21%  73%
 Regular response                     100.00%        17,058       8.27ms      35.18ms     210.08ms     91%  17% 108%     65%  26%  91%
 1MB data (memory)                    100.00%         1,802      21.37ms     332.93ms   3,174.13ms     41%  34%  76%     69%  35% 104%
 1MB data (FS)                        100.00%           973      87.63ms     616.66ms     769.57ms     80%  55% 135%     51%  26%  77%
 4MB data (memory)                    100.00%           447      72.40ms   1,343.75ms   3,500.58ms     23%  30%  54%     67%  35% 103%

 HTTP/2                                                                                                 CPU%/client       CPU%/server 
                                      success           QPS          min          avg          max     usr  sys  u+s     usr  sys  u+s
 Heartbeat (PING frame)               100.00%       207,189       0.66ms       2.90ms      25.10ms     92%   9% 101%     21%  17%  38%
 No response (no waiting)             100.00%        52,231       0.22ms      11.49ms      51.92ms     88%  12%  99%     65%   2%  67%
 Short response (status code)         100.00%        28,652       8.68ms      20.94ms      34.03ms     55%   0%  55%     98%   2% 101%
 Regular response (tiny data)         100.00%        22,074      13.24ms      27.18ms      45.30ms     45%   1%  46%     98%   3% 101%
 1MB data (memory)                    100.00%           917     267.99ms     654.47ms     849.93ms     29%  25%  54%     58%  46% 104%
 1MB data (FS)                        100.00%           526     632.36ms   1,140.09ms   1,436.38ms     86%  37% 123%     47%  28%  75%
 4MB data (memory)                    100.00%           245   2,275.97ms   2,446.24ms   2,589.61ms     22%  25%  47%     51%  48%  99%

 Moleculer                                                                                              CPU%/client      CPU%/server 
                                      success           QPS          min          avg          max     usr  sys  u+s     usr  sys  u+s
 No response                          100.00%        48,149       3.06ms      12.46ms      30.84ms     53%  14%  67%     70%  31% 101%
 Short response (code)                100.00%        39,584       3.33ms      15.16ms      67.85ms     49%  14%  62%     69%  29%  99%
 Regular response                     100.00%        40,412       3.37ms      14.85ms      36.66ms     54%  13%  68%     71%  29% 101%
 64KB data (memory)                   100.00%           189   1,089.91ms   3,179.75ms   3,567.71ms     65%   7%  72%     69%  20%  89%
 64KB data (FS)                       100.00%           211   1,043.49ms   2,847.55ms   4,324.74ms     71%   9%  80%     68%  24%  92%

 Sockety                                                                                                CPU%/client       CPU%/server 
                                      success           QPS          min          avg          max     usr  sys  u+s     usr  sys  u+s
 Heartbeat                            100.00%     2,641,780      60.49μs       0.23ms      18.79ms     95%   5% 100%     29%  10%  40%
 No response                          100.00%       737,141       0.14ms       0.81ms      16.12ms     98%   3% 100%    113%   2% 114%
 Short response (code)                100.00%       319,146       0.28ms       1.88ms      25.83ms     84%   6%  90%     85%  11%  96%
 Regular response                     100.00%       193,893       1.42ms       3.09ms      23.03ms     57%   4%  61%     86%   6%  91%
 1MB data (memory)                    100.00%         2,216       7.05ms     270.82ms     320.65ms     14%  35%  49%     41%  65% 105%
 4MB data (memory)                    100.00%           557       7.67ms   1,076.85ms   1,232.95ms     12%  39%  52%     47%  67% 114%
 1MB file (memory)                    100.00%         2,001       7.97ms     299.88ms     357.94ms     15%  35%  50%     51%  64% 115%
 1MB file (FS)                        100.00%           758     639.69ms     791.33ms   1,021.13ms     56%  40%  96%    113%  30% 143%
```

#### Remote connection

* The server machine was **Basic Droplet » Premium Intel » 1vCPU / 1 GB RAM** from [DigitalOcean](https://www.digitalocean.com/pricing/droplets).
* The client machine was **Basic Droplet » Premium Intel » 4vCPU / 8 GB RAM** from [DigitalOcean](https://www.digitalocean.com/pricing/droplets).
* Machines were connected with private network
* Server started with `node benchmark --server-only -p 41455 -s 1` command, and filtering for each server type
  * Didn't run for Moleculer for now - it needs some additional setup

```
$ node benchmark -c 2 -cc 300 -w 1s -t 3s --remote 10.106.0.3 -p 41455 # and filters
  Node version: 19.2.0
    V8 version: 10.8.168.20-node.8
Client workers: 2
   Connections: 2 × 2 (4)
   Concurrency: 2 × 300 (600)
      Duration: 3,000ms
  Warming time: 1,000ms
 Remote server: 10.106.0.3
          Port: 41455

 HTTP/1                                                                                                 CPU%/client       CPU%/server 
                                      success           QPS          min          avg          max     usr  sys  u+s     usr  sys  u+s
 Short response (status code)         100.00%        15,937      10.11ms      37.65ms     234.33ms     93%  13% 106%     n/a  n/a  n/a
 Regular response                     100.00%        14,049       3.73ms      42.71ms     269.28ms     84%  13%  97%     n/a  n/a  n/a
 1MB data (memory)                    100.00%            53   3,037.44ms  11,427.06ms  11,399.12ms      5%   3%   9%     n/a  n/a  n/a
 1MB data (FS)                         98.37%            87     506.45ms   6,923.41ms   7,657.25ms     21%  10%  31%     n/a  n/a  n/a
  Failed 11 times
 4MB data (memory)                    100.00%            14   7,995.20ms  42,627.92ms  42,624.02ms      4%   5%   9%     n/a  n/a  n/a

 HTTP/2                                                                                                 CPU%/client       CPU%/server 
                                      success           QPS          min          avg          max     usr  sys  u+s     usr  sys  u+s
 Heartbeat (PING frame)               100.00%       220,942       0.61ms       2.72ms      22.96ms     94%   5%  99%     n/a  n/a  n/a
 No response (no waiting)             100.00%        51,807       0.19ms      11.58ms      84.44ms    102%  19% 122%     n/a  n/a  n/a
 Short response (status code)         100.00%        28,835       4.73ms      20.81ms      67.58ms     68%   4%  72%     n/a  n/a  n/a
 Regular response (tiny data)         100.00%        24,326       5.35ms      24.66ms      67.16ms     55%   1%  56%     n/a  n/a  n/a
 1MB data (memory)                    100.00%           157   3,573.68ms   3,809.53ms   3,843.43ms      8%  10%  18%     n/a  n/a  n/a
 1MB data (FS)                        100.00%           162   3,424.77ms   3,694.48ms   3,706.54ms     40%  15%  54%     n/a  n/a  n/a
 4MB data (memory)                    100.00%            47  12,412.20ms  12,877.07ms  13,020.66ms      8%   8%  16%     n/a  n/a  n/a

 Sockety                                                                                                CPU%/client       CPU%/server 
                                      success           QPS          min          avg          max     usr  sys  u+s     usr  sys  u+s
 Heartbeat                            100.00%     2,340,636      43.08μs       0.26ms      15.26ms     92%  10% 102%     n/a  n/a  n/a
 No response                          100.00%       675,082       0.13ms       0.89ms       8.86ms     97%   8% 105%     n/a  n/a  n/a
 Short response (code)                100.00%       261,708       0.57ms       2.29ms      49.47ms     74%   7%  81%     n/a  n/a  n/a
 Regular response                     100.00%       231,902       0.69ms       2.59ms      17.32ms     83%   7%  90%     n/a  n/a  n/a
 1MB data (memory)                    100.00%           243       8.49ms   2,467.63ms   3,043.74ms      7%   5%  11%     n/a  n/a  n/a
 4MB data (memory)                    100.00%            61       9.22ms   9,882.08ms  10,866.41ms      3%   4%   7%     n/a  n/a  n/a
 1MB file (memory)                    100.00%           243       7.81ms   2,466.71ms   3,143.79ms      6%   4%  10%     n/a  n/a  n/a
 1MB file (FS)                        100.00%           238     900.14ms   1,679.63ms   2,105.90ms     21%  14%  35%     n/a  n/a  n/a
```

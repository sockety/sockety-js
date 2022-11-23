# Sockety - blazing fast communication protocol

This library is a simple and fast client/server implementation for the [**Sockety** protocol](https://github.com/sockety/protocol).
It works over TCP, either directly or secured with TLS.

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

Despite it has all required features, it's really fast - native Node.js implementation of HTTP/2 is at least few times, and happens to be even 10x slower than **Sockety**.

## Usage

The Sockety library is pretty simple to use. Both server and client have mostly options inherited from `net.Socket` or `tls.TLSSocket`.

### Running server

To run the server, you should simply start it, and watch for messages/errors for every connection.

```ts
import { createServer, FastReply } from 'sockety';

// Instantiate server
const server = createServer();

// Handle connections
server.on('connection', connection => {
  connection.on('message', async message => {
      console.log(`Received "${message.action}" message: ${message.id}`);

      if (message.action === 'log') {
          console.log(`[Log Request] ${await message.msgpack()}`);
          await message.fastReply(FastReply.Accept);
      } else if (message.action === 'ping') {
          const request = message.respond({ data: 'pong' });
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
import { createServer, MessageHandler, FastReply } from 'sockety';

// Instantiate server
const server = createServer();

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
        const request = message.respond({ data: 'pong' });
        await request.sent();
    })
    .error(() => FastReply.InternalError)
    .use(() => FastReply.NotImplemented);

// Handle connections
server.on('connection', connection => {
  connection.on('message', handleMessage);
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
const log = Draft.for('log').msgpack<string>().createFactory();
const ping = Draft.for('ping').createFactory();

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
    // TODO: Use Msgpack
    const response2 = await client.send(ping()).response();
    console.log((await response2.dataBuffer()).toString()); // "pong"
});
```

### Examples

You may look at examples in this repository in [`packages/examples`](https://github.com/sockety/sockety-js/tree/main/packages/examples) directory.

* [**Chat**](https://github.com/sockety/sockety-js/tree/main/packages/examples/chat) - real-time chat example

const { createServer, createSecureServer, connect, secureConnect } = require('../../../sockety');
const { heartbeat } = require('../../../core/src/producers/heartbeat');
const { createMessage } = require('../../../core/src/createMessage');
const { certificate, privateKey } = require('../../tls');
const { kb512, mb1, mb4 } = require('../../files');
const { suite, benchmark, prepareClient, prepareServer } = require('../declare');
const { makePool } = require('../makePool');

function common() {
  benchmark('HEARTBEAT frame', ({ getClient }) => getClient().pass(heartbeat));

  {
    const message = createMessage({ action: 'ping' }, false);
    benchmark('One-way message', ({ getClient }) => getClient().pass(message));
  }

  {
    const message = createMessage({ action: 'fast' }, false);
    benchmark('ACKed message', async ({ getClient }) => getClient().send(message).response());
  }

  {
    const message = createMessage({ action: 'echo' }, false);
    benchmark('Echo message', async ({ getClient }) => getClient().send(message).response());
  }

  {
    const message = createMessage({ action: 'ping', files: [ { name: 'file-1.txt', buffer: mb1.content } ] }, false);
    benchmark('1MB file', async ({ getClient }) => getClient().pass(message));
  }

  {
    benchmark('1MB file from FS', async ({ getClient }) => {
      const message = createMessage({ action: 'ping', files: [ { name: 'file-1.txt', size: mb1.content.length, stream: mb1.stream() } ] }, false);
      return getClient().pass(message);
    });
  }

  {
    benchmark('2x 0.5MB file from FS', async ({ getClient }) => {
      const message = createMessage({ action: 'ping', files: [
        { name: 'file-1.txt', size: kb512.content.length, stream: kb512.stream() },
        { name: 'file-2.txt', size: kb512.content.length, stream: kb512.stream() },
      ] }, false);
      return getClient().pass(message);
    });
  }

  {
    const message = createMessage({ action: 'ping', data: mb1.content }, false);
    benchmark('1MB data', async ({ getClient }) => getClient().pass(message));
  }

  {
    const message = createMessage({ action: 'ping', data: mb4.content }, false);
    benchmark('4MB data', async ({ getClient }) => getClient().pass(message));
  }
}

async function messageListener(message) {
  if (message.action === 'echo') {
    await message.respond({});
  } else if (message.action === 'fast') {
    await message.accept();
  }
}

suite('Sockety', () => {
  prepareServer(async ({ config: { port } }) => {
    const server = createServer();
    server.on('error', () => {});
    server.on('connection', (connection) => {
      connection.on('message', messageListener);
    });

    await new Promise((resolve, reject) => {
      server.listen({ port }, (error) => {
        if (error == null) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  });

  prepareClient(async (context) => {
    const { connectionsPerWorker, port, remoteHost } = context.config;
    const host = remoteHost || 'localhost';

    context.getClient = await makePool(connectionsPerWorker, async () => {
      const socket = await connect({ host, port }).ready();
      socket.on('error', (e) => console.error(e));
      return socket;
    });
  });

  common();
});

suite('Sockety TLS', () => {
  prepareServer(async ({ config: { port } }) => {
    const server = createSecureServer({ cert: certificate, key: privateKey });
    server.on('error', () => {});
    server.on('connection', (connection) => {
      connection.on('message', messageListener);
    });

    await new Promise((resolve, reject) => {
      server.listen({ port }, (error) => {
        if (error == null) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  });

  prepareClient(async (context) => {
    const { connectionsPerWorker, port, remoteHost } = context.config;
    const host = remoteHost || 'localhost';

    context.getClient = await makePool(connectionsPerWorker, async () => {
      const socket = await secureConnect({ ca: certificate, host, port }).ready();
      socket.on('error', (e) => console.error(e));
      return socket;
    });
  });

  common();
});

const { Draft, createServer, createSecureServer, connect, secureConnect } = require('../../../sockety');
const { heartbeat } = require('../../../core/src/producers/heartbeat');
const { certificate, privateKey } = require('../../tls');
const { kb512, mb1, mb4 } = require('../../files');
const { suite, benchmark, prepareClient, prepareServer } = require('../declare');
const { makePool } = require('../makePool');

function common() {
  benchmark('HEARTBEAT frame', ({ getClient }) => getClient().pass(heartbeat));

  {
    const message = Draft.for('ping').createFactory()();
    benchmark('One-way message', ({ getClient }) => getClient().pass(message));
  }

  {
    const message = Draft.for('fast').createFactory()();
    benchmark('ACKed message', async ({ getClient }) => getClient().send(message).response());
  }

  {
    const message = Draft.for('echo').createFactory()();
    benchmark('Echo message', async ({ getClient }) => getClient().send(message).response());
  }

  {
    const message = Draft.for('ping')
      .files([ { name: 'file-1.txt', buffer: mb1.content } ])
      .createFactory()();
    benchmark('1MB file', async ({ getClient }) => getClient().pass(message));
  }

  {
    const factory = Draft.for('ping').files().createFactory();
    benchmark('1MB file from FS', async ({ getClient }) => {
      const message = factory({ files: [ { name: 'file-1.txt', size: mb1.content.length, stream: mb1.stream() } ] });
      return getClient().pass(message);
    });
  }

  {
    const factory = Draft.for('ping').files().createFactory();
    benchmark('2x 0.5MB file from FS', async ({ getClient }) => {
      const message = factory({ files: [
        { name: 'file-1.txt', size: kb512.content.length, stream: kb512.stream() },
        { name: 'file-2.txt', size: kb512.content.length, stream: kb512.stream() },
      ] });
      return getClient().pass(message);
    });
  }

  {
    const message = Draft.for('ping').data(mb1.content).createFactory()();
    benchmark('1MB data', async ({ getClient }) => getClient().pass(message));
  }

  {
    const message = Draft.for('ping').data(mb4.content).createFactory()();
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

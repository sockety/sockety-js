const { MessageHandler, Draft, createServer, createSecureServer, connect, secureConnect, FastReply, ResponseDraft } = require('../../../sockety');
const { heartbeat } = require('../../../core/src/producers/heartbeat');
const { FileTransfer } = require('../../../core/src/FileTransfer');
const { certificate, privateKey } = require('../../tls');
const { mb1, mb4 } = require('../../files');
const { suite, benchmark, prepareClient, prepareServer } = require('../declare');
const { makePool } = require('../makePool');

function common() {
  benchmark('Heartbeat', ({ getClient }) => getClient().pass(heartbeat));

  {
    const message = Draft.for('ping').optimize()();
    benchmark('No response', ({ getClient }) => getClient().pass(message));
  }

  {
    const message = Draft.for('fast').optimize()();
    benchmark('Short response (code)', async ({ getClient }) => getClient().send(message).response());
  }

  {
    const message = Draft.for('echo').optimize()();
    benchmark('Regular response', async ({ getClient }) => getClient().send(message).response());
  }

  {
    const message = Draft.for('ping').data(mb1.content).optimize()();
    benchmark('1MB data (memory)', async ({ getClient }) => getClient().pass(message));
  }

  {
    const message = Draft.for('ping').data(mb4.content).optimize()();
    benchmark('4MB data (memory)', async ({ getClient }) => getClient().pass(message));
  }

  {
    const message = Draft.for('ping')
      .files([ FileTransfer.buffer(mb1.content, 'file-1.txt') ])
      .optimize()();
    benchmark('1MB file (memory)', async ({ getClient }) => getClient().pass(message));
  }

  {
    const factory = Draft.for('ping').files().optimize();
    benchmark('1MB file (FS)', async ({ getClient }) => {
      const message = factory({ files: [ FileTransfer.stream(mb1.stream(), mb1.content.length, 'file-1.txt') ] });
      return getClient().pass(message);
    });
  }
}

const echoResponse = new ResponseDraft().optimize()();
const messageListener = new MessageHandler()
  .action('ping', () => undefined)
  .action('echo', (message) => message.respond(echoResponse).sent())
  .action('fast', () => FastReply.Accept)
  .optimize();

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

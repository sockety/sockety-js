const net = require('node:net');
const tls = require('node:tls');
const { UUIDMap } = require('../../../core/src/UuidMap');
const { accept } = require('../../../core/src/producers/accept');
const { heartbeat } = require('../../../core/src/producers/heartbeat');
const { createMessage } = require('../../../core/src/createMessage');
const { Socket } = require('../../../core/src/Socket');
const { createContentProducer } = require('../../../core/src/ContentProducer');
const { MessageDataSizeBits, MessageFilesSizeBits, MessageFilesCountBits, MessageActionSizeBits } = require('../../../core/src/constants');
const { certificate, privateKey } = require('../../tls');
const { kb512, mb1, mb4 } = require('../../files');
const { suite, benchmark, prepareClient, prepareServer } = require('../declare');
const { generateUuid } = require('@sockety/uuid');
const { makePool } = require('../makePool');

function common() {
  benchmark('HEARTBEAT frame', ({ getClient }) => getClient().pass(heartbeat));

  {
    const message = createMessage({ action: 'ping' }, false);
    benchmark('One-way message', ({ getClient }) => getClient().pass(message));
  }

  {
    const message = createMessage({ action: 'fast' }, false);
    benchmark('ACKed message', async ({ getClient, bucket }) => {
      const outgoing = getClient().send(message);
      await new Promise((resolve) => {
        const current = bucket.get(outgoing.id);
        if (current) {
          resolve(null);
        } else {
          bucket.set(outgoing.id, resolve);
        }
      });
    });
  }

  {
    const message = createMessage({ action: 'echo' }, false);
    benchmark('Echo message', async ({ getClient, bucket }) => {
      const outgoing = getClient().send(message);
      await new Promise((resolve) => {
        const current = bucket.get(outgoing.id);
        if (current) {
          resolve(null);
        } else {
          bucket.set(outgoing.id, resolve);
        }
      });
    });
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

async function messageListener(connection, message) {
  if (message.action === 'echo') {
    await connection.pass(createContentProducer((writer, expectsResponse, callback) => {
      writer.reserveChannel((channelId, release) => writer.drained(async () => {
        writer.channel(channelId);
        writer.startResponse(false, false);
        writer.writeUint8(MessageDataSizeBits.None | MessageFilesCountBits.None);
        writer.writeUuid(message.id);
        writer.writeUuid(generateUuid());
        release();
        writer.addCallback(callback);
      }));
    }));
  } else if (message.action === 'fast') {
    await connection.pass(accept(message.id));
  }
}

suite('Sockety', () => {
  prepareServer(async ({ config: { port } }) => {
    const server = net.createServer((socket) => {
      const connection = new Socket(socket);
      connection.on('message', (message) => messageListener(connection, message));
    });
    server.on('error', () => {});

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
    const bucket = context.bucket = new UUIDMap();
    const noop = () => {};
    const received = (id) => {
      const current = bucket.get(id);
      if (current) {
        current();
      } else {
        bucket.set(id, noop);
      }
    };

    context.getClient = await makePool(connectionsPerWorker, async () => {
      const socket = await new Promise((resolve, reject) => {
        const socket = net.connect({ host, port }, (error) => {
          if (error == null) {
            resolve(new Socket(socket));
          } else {
            reject(error);
          }
        });
      });
      socket.on('response', (message) => received(message.parentId));
      socket.on('fast-reply', (id) => received(id));
      socket.on('error', (e) => console.error(e));
      return socket;
    });
  });

  common();
});

suite('Sockety TLS', () => {
  prepareServer(async ({ config: { port } }) => {
    const server = tls.createServer({ cert: certificate, key: privateKey }, (socket) => {
      const connection = new Socket(socket);
      connection.on('message', (message) => messageListener(connection, message));
    });
    server.on('error', () => {});

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
    const bucket = context.bucket = new UUIDMap();
    const noop = () => {};
    const received = (id) => {
      const current = bucket.get(id);
      if (current) {
        current();
      } else {
        bucket.set(id, noop);
      }
    };

    context.getClient = await makePool(connectionsPerWorker, async () => {
      const socket = await new Promise((resolve, reject) => {
        const socket = tls.connect({ ca: certificate, host, port }, (error) => {
          if (error == null) {
            resolve(new Socket(socket));
          } else {
            reject(error);
          }
        });
      });
      socket.on('response', (message) => received(message.parentId));
      socket.on('fast-reply', (id) => received(id));
      socket.on('error', (e) => console.error(e));
      return socket;
    });
  });

  common();
});

const net = require('node:net');
const tls = require('node:tls');
const { UUIDMap } = require('../../../core/src/UuidMap');
const { ack } = require('../../../core/src/producers/ack');
const { heartbeat } = require('../../../core/src/producers/heartbeat');
const { createMessage } = require('../../../core/src/createMessage');
const { Socket } = require('../../../core/src/Socket');
const { createContentProducer } = require('../../../core/src/ContentProducer');
const { MessageDataSizeBits, MessageFilesSizeBits, MessageFilesCountBits, MessageActionSizeBits } = require('../../../core/src/constants');
const { certificate, privateKey } = require('../../tls');
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
    benchmark('ACKed message', async ({ getClient, bucket }) => {
      const outgoing = await getClient().send(message);
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
      const outgoing = await getClient().send(message);
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
    const message = createMessage({ action: 'ping', files: [ { name: 'file-1.txt', buffer: Buffer.allocUnsafe(1024 * 1024) } ] }, false);
    benchmark('1MB file', async ({ getClient }) => getClient().pass(message));
  }

  {
    const message = createMessage({ action: 'ping', data: Buffer.allocUnsafe(1024 * 1024) }, false);
    benchmark('1MB data', async ({ getClient }) => getClient().pass(message));
  }

  {
    const message = createMessage({ action: 'ping', data: Buffer.allocUnsafe(4 * 1024 * 1024) }, false);
    benchmark('4MB data', async ({ getClient }) => getClient().pass(message));
  }
}

async function messageListener(connection, message) {
  if (message.action === 'echo') {
    await connection.pass(createContentProducer((writer, expectsResponse, callback) => {
      writer.reserveChannel((channelId, release) => writer.drained(async () => {
        writer.notifyLength(2 + 1 + 1 + 16 + 5);
        writer.ensureChannel(channelId);
        writer.writeMessageSignature(1 + 16 + 5, false, false);
        writer.writeUint8(MessageDataSizeBits.None | MessageFilesSizeBits.Uint16 | MessageFilesCountBits.None | MessageActionSizeBits.Uint8);
        writer.writeUuid(message.id);
        writer.writeUint8(4);
        writer.writeUint8(101);
        writer.writeUint8(99);
        writer.writeUint8(104);
        writer.writeUint8(111);
        release();
        writer.addListener(callback);
      }));
    }));
  } else if (message.action === 'fast') {
    await connection.pass(ack(message.id));
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
      socket.on('message', (message) => received(message.id));
      socket.on('ack', (id) => received(id));
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
      socket.on('message', (message) => received(message.id));
      socket.on('ack', (id) => received(id));
      socket.on('error', (e) => console.error(e));
      return socket;
    });
  });

  common();
});

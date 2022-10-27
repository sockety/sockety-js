const http2 = require('node:http2');
const stream = require('node:stream');
const { certificate, privateKey } = require('../../tls');
const { suite, benchmark, prepareClient, prepareServer } = require('../declare');
const { makePool } = require('../makePool');

function common() {
  benchmark('PING frame', async ({ getClient }) => new Promise((resolve, reject) => {
    getClient().ping((error) => {
      if (error == null) {
        resolve();
      } else {
        reject(error);
      }
    });
  }));

  benchmark('Request / empty response', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/fast' });
    req.on('finish', resolve);
    req.on('error', reject);
    req.end();
  }));

  benchmark('Request / short response', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/ping' });
    req.on('data', resolve);
    req.on('error', reject);
    req.end();
  }));

  const mb1 = Buffer.allocUnsafe(1024 * 1024);
  benchmark('1MB data', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/data', ':method': 'POST', 'Content-Length': mb1.length });
    req.on('finish', resolve);
    req.on('error', reject);
    stream.Readable.from(mb1).pipe(req);
  }));

  const mb4 = Buffer.allocUnsafe(4 * 1024 * 1024);
  benchmark('4MB data', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/data', ':method': 'POST', 'Content-Length': mb4.length });
    req.on('finish', resolve);
    req.on('error', reject);
    stream.Readable.from(mb4).pipe(req);
  }));
}

async function streamListener(stream, headers) {
  if (headers[':path'] === '/ping') {
    stream.end('pong');
  } else if (headers[':path'] === '/data') {
    const contentLength = Number(headers['content-length']) || 0;
    if (contentLength > 0) {
      await new Promise((resolve) => {
        let receivedLength = 0;
        stream.on('data', (chunk) => {
          receivedLength += chunk.length;
          if (receivedLength >= contentLength) {
            resolve();
          }
        });
      });
    }
    stream.end();
  } else {
    stream.respond({ ':status': 200 });
    stream.end();
  }
}

suite('HTTP/2', () => {
  prepareServer(async ({ config: { port } }) => {
    const server = http2.createServer({
      maxSessionRejectedStreams: 5000,
      maxSessionInvalidFrames: 50000,
      peerMaxConcurrentStreams: 5000,
      maxSessionMemory: 500,
      maxOutstandingPings: 500,
      maxHeaderListPairs: 128 * 50,
      maxSendHeaderBlockLength: 500000000,
    });
    server.on('error', () => {});
    server.on('stream', streamListener);

    await new Promise((resolve, reject) => {
      server.listen(port, (error) => {
        if (error == null) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  });

  prepareClient(async (context) => {
    const { connectionsPerWorker, port } = context.config;
    context.getClient = await makePool(connectionsPerWorker, () => new Promise((resolve, reject) => {
      const client = http2.connect(`http://localhost:${port}`, {
        // Increase all limits to avoid NGHTTP2_ENHANCE_YOUR_CALM
        maxReservedRemoteStreams: 10000,
        maxHeaderListPairs: 128 * 50,
        maxOutstandingPings: 500,
        peerMaxConcurrentStreams: 5000,
        maxSessionMemory: 500,
        maxSendHeaderBlockLength: 500000000,
      });
      client.on('error', reject);
      client.on('connect', resolve);
    }));
  });

  common();
});

suite('HTTPS/2', () => {
  prepareServer(async ({ config: { port } }) => {
    const server = http2.createSecureServer({
      cert: certificate,
      key: privateKey,
      maxSessionRejectedStreams: 5000,
      maxSessionInvalidFrames: 50000,
      peerMaxConcurrentStreams: 5000,
      maxSessionMemory: 500,
      maxOutstandingPings: 500,
      maxHeaderListPairs: 128 * 50,
      maxSendHeaderBlockLength: 500000000,
    });
    server.on('error', () => {});
    server.on('stream', streamListener);

    await new Promise((resolve, reject) => {
      server.listen(port, (error) => {
        if (error == null) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  });

  prepareClient(async (context) => {
    const { connectionsPerWorker, port } = context.config;
    context.getClient = await makePool(connectionsPerWorker, () => new Promise((resolve, reject) => {
      const client = http2.connect(`https://localhost:${port}`, {
        ca: certificate,
        // Increase all limits to avoid NGHTTP2_ENHANCE_YOUR_CALM
        maxReservedRemoteStreams: 10000,
        maxHeaderListPairs: 128 * 50,
        maxOutstandingPings: 500,
        peerMaxConcurrentStreams: 5000,
        maxSessionMemory: 500,
        maxSendHeaderBlockLength: 500000000,
      });
      client.on('error', reject);
      client.on('connect', resolve);
    }));
  });

  common();
});
const http2 = require('node:http2');
const stream = require('node:stream');
const { certificate, privateKey } = require('../../tls');
const { mb1, mb4 } = require('../../files');
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

  benchmark('Request / no response', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/fast' });
    req.on('finish', resolve);
    req.on('error', reject);
    req.end();
  }));

  benchmark('Request / empty response', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/fast' });
    req.on('response', resolve);
    req.on('error', reject);
    req.end();
  }));

  benchmark('Request / short response', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/ping' });
    req.on('data', resolve);
    req.on('error', reject);
    req.end();
  }));

  benchmark('1MB data', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/data', ':method': 'POST', 'Content-Length': mb1.content.length });
    req.on('finish', resolve);
    req.on('error', reject);
    stream.Readable.from(mb1.content).pipe(req);
  }));

  benchmark('1MB data from FS', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/data', ':method': 'POST', 'Content-Length': mb1.content.length });
    req.on('finish', resolve);
    req.on('error', reject);
    mb1.stream().pipe(req);
  }));

  benchmark('4MB data', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/data', ':method': 'POST', 'Content-Length': mb4.content.length });
    req.on('finish', resolve);
    req.on('error', reject);
    stream.Readable.from(mb4.content).pipe(req);
  }));

  benchmark('4MB data from FS', async ({ getClient }) => new Promise((resolve, reject) => {
    const req = getClient().request({ ':path': '/data', ':method': 'POST', 'Content-Length': mb4.content.length });
    req.on('finish', resolve);
    req.on('error', reject);
    mb4.stream().pipe(req);
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
    const { connectionsPerWorker, port, remoteHost } = context.config;
    const host = remoteHost || 'localhost';
    context.getClient = await makePool(connectionsPerWorker, () => new Promise((resolve, reject) => {
      const client = http2.connect(`http://${host}:${port}`, {
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
    const { connectionsPerWorker, port, remoteHost } = context.config;
    const host = remoteHost || 'localhost';
    context.getClient = await makePool(connectionsPerWorker, () => new Promise((resolve, reject) => {
      const client = http2.connect(`https://${host}:${port}`, {
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

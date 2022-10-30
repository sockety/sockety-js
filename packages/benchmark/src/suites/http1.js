const http = require('node:http');
const https = require('node:https');
const { Readable } = require('node:stream');
const { certificate, privateKey } = require('../../tls');
const { mb1, mb4 } = require('../../files');
const { suite, benchmark, prepareClient, prepareServer } = require('../declare');

function common() {
  benchmark('Request / empty response', async ({ call }) => call('/fast'));

  benchmark('Request / short response', async ({ call }) => call('/ping'));

  benchmark('1MB data', async ({ call }) => call('/data', { method: 'POST', headers: { 'Content-Length': mb1.content.length } }, Readable.from(mb1.content)));

  benchmark('1MB data from FS', async ({ call }) => call('/data', { method: 'POST', headers: { 'Content-Length': mb1.content.length } }, mb1.stream()));

  benchmark('4MB data', async ({ call }) => call('/data', { method: 'POST', headers: { 'Content-Length': mb4.content.length } }, Readable.from(mb4.content)));

  benchmark('4MB data from FS', async ({ call }) => call('/data', { method: 'POST', headers: { 'Content-Length': mb4.content.length } }, mb4.stream()));
}

async function requestListener(req, res) {
  if (req.url === '/ping') {
    res.writeHead(200);
    res.end('pong');
  } else if (req.url === '/data') {
    const contentLength = Number(req.headers['content-length']) || 0;
    if (contentLength > 0) {
      await new Promise((resolve) => {
        let receivedLength = 0;
        req.on('data', (chunk) => {
          receivedLength += chunk.length;
          if (receivedLength >= contentLength) {
            resolve();
          }
        });
      });
    }
    res.writeHead(200);
    res.end();
  } else {
    res.writeHead(200);
    res.end();
  }
}

suite('HTTP/1', () => {
  prepareServer(async ({ config: { port } }) => {
    const server = http.createServer(requestListener);
    server.on('error', () => {});

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
    const { port, remoteHost } = context.config;
    const host = remoteHost || 'localhost';
    context.http = http;
    context.url = (url) => `http://${host}:${port}${url}`;
    context.call = (url, options = {}, stream) => new Promise((resolve, reject) => {
      const req = http.request(context.url(url), options, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
        res.on('error', reject);
      });
      req.on('error', reject);
      if (stream) {
        stream.pipe(req);
      } else {
        req.end();
      }
    });
  });

  common();
});

suite('HTTPS/1', () => {
  prepareServer(async ({ config: { port } }) => {
    const server = https.createServer({ cert: certificate, key: privateKey }, requestListener);
    server.on('error', () => {});

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
    const { port, remoteHost } = context.config;
    const host = remoteHost || 'localhost';
    context.http = https;
    context.url = (url) => `https://${host}:${port}${url}`;
    context.call = (url, options = {}, stream) => new Promise((resolve, reject) => {
      const req = https.request(context.url(url), { ...options, ca: certificate }, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
        res.on('error', reject);
      });
      req.on('error', reject);
      if (stream) {
        stream.pipe(req);
      } else {
        req.end();
      }
    });
  });

  common();
});

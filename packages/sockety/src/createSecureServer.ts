import * as tls from 'node:tls';
import { Connection } from './Connection';
import { Server } from './Server';
import { SecureServerOptions } from './types';

export function createSecureServer(options: SecureServerOptions, connectionListener?: (connection: Connection) => void): Server {
  const server = new Server(tls.createServer(options), options);
  if (connectionListener) {
    server.on('connection', connectionListener);
  }
  return server;
}

import * as net from 'node:net';
import { Connection } from './Connection';
import { Server } from './Server';
import { ServerOptions } from './types';

export function createServer(options: ServerOptions = {}, connectionListener?: (connection: Connection) => void): Server {
  const server = new Server(net.createServer(options), options);
  if (connectionListener) {
    server.on('connection', connectionListener);
  }
  return server;
}

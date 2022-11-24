import { Server } from 'node:net';
import { Server as TLSServer } from 'node:tls';

export function isTlsServer(server: Server): server is TLSServer {
  return Boolean((server as any).sessionIdContext);
}

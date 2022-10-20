import { Socket } from 'node:net';
import { TLSSocket } from 'node:tls';

export function isTlsSocket(socket: Socket): socket is TLSSocket {
  return Boolean((socket as any).encrypted);
}

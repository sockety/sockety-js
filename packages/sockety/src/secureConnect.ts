import * as tls from 'node:tls';
import { SecureConnectOptions } from './types';
import { Connection } from './Connection';

export function secureConnect(options: SecureConnectOptions): Connection;
export function secureConnect(port: number, options?: SecureConnectOptions): Connection;
export function secureConnect(port: number, host?: string, options?: SecureConnectOptions): Connection;
export function secureConnect(path: string, options?: SecureConnectOptions): Connection;
export function secureConnect(arg1: SecureConnectOptions | number | string, arg2?: SecureConnectOptions | string, arg3?: SecureConnectOptions): Connection {
  if (
    (typeof arg1 === 'number' || typeof arg1 === 'string') &&
    (typeof arg2 === 'string')
  ) {
    // tls.connect(port, host);
    const socket = tls.connect(arg1 as any, arg2);
    const options: SecureConnectOptions = arg3 as any;
    return new Connection(socket, options);
  } else if (typeof arg1 === 'number' || typeof arg1 === 'string') {
    // tls.connect(port) or tls.connect(path)
    const socket = tls.connect(arg1 as any);
    const options: SecureConnectOptions = (arg2 || arg3) as any;
    return new Connection(socket, options);
  } else {
    // tls.connect(options);
    const socket = tls.connect(arg1);
    const options: SecureConnectOptions = (arg2 || arg3) as any;
    return new Connection(socket, options);
  }
}

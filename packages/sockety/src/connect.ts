import * as net from 'node:net';
import { ConnectOptions } from './types';
import { Connection } from './Connection';

export function connect(options: ConnectOptions): Connection;
export function connect(port: number, options?: ConnectOptions): Connection;
export function connect(port: number, host?: string, options?: ConnectOptions): Connection;
export function connect(path: string, options?: ConnectOptions): Connection;
export function connect(arg1: ConnectOptions | number | string, arg2?: ConnectOptions | string, arg3?: ConnectOptions): Connection {
  if (
    (typeof arg1 === 'number' || typeof arg1 === 'string') &&
    (typeof arg2 === 'string')
  ) {
    // net.connect(port, host);
    const socket = net.connect(arg1 as any, arg2);
    const options: ConnectOptions = arg3 as any;
    return new Connection(socket, options);
  } else if (typeof arg1 === 'number' || typeof arg1 === 'string') {
    // net.connect(port) or net.connect(path)
    const socket = net.connect(arg1 as any);
    const options: ConnectOptions = (arg2 || arg3) as any;
    return new Connection(socket, options);
  } else {
    // net.connect(options);
    const socket = net.connect(arg1);
    const options: ConnectOptions = (arg2 || arg3) as any;
    return new Connection(socket, options);
  }
}

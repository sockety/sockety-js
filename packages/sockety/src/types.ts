import type { Duplex } from 'node:stream';
import type * as net from 'node:net';
import type * as tls from 'node:tls';

export interface RawConnectOptions {
  maxReceivedChannels?: number; // default: 4096
  maxWritableChannels?: number; // default: 4096
  connectTimeout?: number; // default: none
  timeout?: number; // default: none
  allowFilesSizeMismatch?: number; // default: false // TODO
  immediateFlushBytes?: number; // default: 65_000
  maxInlineUtf8Bytes?: number; // default: 60_000
  maxInlineBufferBytes?: number; // default: 30_000
}

export type ConnectOptions = RawConnectOptions & net.NetConnectOpts;
export type SecureConnectOptions = RawConnectOptions & tls.ConnectionOptions;

export interface RawServerOptions {
  maxReceivedChannels?: number; // default: 4096
  maxWritableChannels?: number; // default: 4096
  timeout?: number; // default: 60000
  allowFilesSizeMismatch?: number; // default: false // TODO
  immediateFlushBytes?: number; // default: 65_000
  maxInlineUtf8Bytes?: number; // default: 60_000
  maxInlineBufferBytes?: number; // default: 30_000
}

export interface ServerOptions extends RawServerOptions, net.ServerOpts {}
export interface SecureServerOptions extends RawServerOptions, tls.TlsOptions {}

export interface TcpSocket extends Duplex {
  setKeepAlive(keepAlive: boolean): void;
  setTimeout(timeout: number): void;
  connecting: boolean;
}

export interface TcpServer {
  on(event: 'connection' | 'secureConnection', listener: (socket: TcpSocket) => void): void;
  off(event: 'connection' | 'secureConnection', listener: (socket: TcpSocket) => void): void;
  on(event: 'error', listener: (error: any) => void): void;
  off(event: 'error', listener: (error: any) => void): void;
  on(event: 'listening', listener: () => void): void;
  off(event: 'listening', listener: () => void): void;
  on(event: 'close', listener: () => void): void;
  off(event: 'close', listener: () => void): void;
  ref(): void;
  unref(): void;
  close(callback: (error?: Error) => void): void;
  getConnections(callback: (error: Error | null, count: number) => void): void;
  listen: net.Server['listen'];
  maxConnections: number;
  connections: number;
  listening: boolean;
}

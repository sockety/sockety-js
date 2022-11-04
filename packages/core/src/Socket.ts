import { EventEmitter } from 'node:events';
import type * as net from 'node:net';
import type * as tls from 'node:tls';
import { UUID } from '@sockety/uuid';
import { isTlsSocket } from './utils/isTlsSocket';
import { RawMessage } from './read/RawMessage';
import { ContentProducer } from './ContentProducer';
import { Request } from './Request';
import { StreamParser } from './read/StreamParser';
import { StreamWriter } from './StreamWriter';
import { FastReply } from './constants';
import { RawResponse } from './read/RawResponse';

type RawSocket = tls.TLSSocket | net.Socket;

const noop = () => {};

// TODO: Add event types
// TODO: Extract reading and messages out of socket?
export class Socket extends EventEmitter {
  readonly #writer: StreamWriter;
  readonly #parser: StreamParser;
  #socket: RawSocket | null;
  #closing = false;

  public constructor(socket: RawSocket) {
    super();

    // Set up socket
    this.#socket = socket;
    this.#socket.setKeepAlive(true);
    this.#writer = new StreamWriter(this.#socket, { maxChannels: 4095 });
    this.#parser = new StreamParser();

    // Pass events down
    // TODO: Handle timeout
    socket.pipe(this.#parser);
    this.#parser.on('message', (message) => this.emit('message', message));
    this.#parser.on('response', (response) => this.emit('response', response));
    this.#parser.on('fast-reply', (uuid) => this.emit('fast-reply', uuid));
    this.#socket.once('close', () => this.close(true));
    this.#socket.on('error', (error) => this.emit('error', error));
    this.#socket.once(isTlsSocket(this.#socket) ? 'secureConnect' : 'connect', () => this.emit('connect'));
  }

  public pass(producer: ContentProducer): Promise<void> {
    return new Promise<void>((resolve, reject) => producer(this.#writer, (error) => {
      if (error == null) {
        resolve();
      } else {
        reject(error);
      }
    }, noop, false));
  }

  public send<T extends Request<any>>(producer: ContentProducer<T>): T {
    return producer(this.#writer, noop, noop, true);
  }

  public async close(force: boolean): Promise<void> {
    // Do nothing if it's already closed
    if (!this.#socket) {
      return;
    }

    // Mark as closing
    this.#closing = true;

    // Wait until current messages will be sent if not force
    if (!force) {
      // TODO: Wait for empty stream
    }

    // Destroy socket
    // TODO: Abort current streams
    this.#socket.removeAllListeners();
    this.#socket.destroy();
    this.#socket = null;
    this.emit('close');
  }
}

export interface Socket {
  addListener(event: 'message', listener: (message: RawMessage) => void): this;
  on(event: 'message', listener: (message: RawMessage) => void): this;
  once(event: 'message', listener: (message: RawMessage) => void): this;
  prependListener(event: 'message', listener: (message: RawMessage) => void): this;
  prependOnceListener(event: 'message', listener: (message: RawMessage) => void): this;
  removeListener(event: 'message', listener: (message: RawMessage) => void): this;
  emit(event: 'message', message: RawMessage): boolean;

  addListener(event: 'response', listener: (response: RawResponse) => void): this;
  on(event: 'response', listener: (response: RawResponse) => void): this;
  once(event: 'response', listener: (response: RawResponse) => void): this;
  prependListener(event: 'response', listener: (response: RawResponse) => void): this;
  prependOnceListener(event: 'response', listener: (response: RawResponse) => void): this;
  removeListener(event: 'response', listener: (response: RawResponse) => void): this;
  emit(event: 'response', response: RawResponse): boolean;

  addListener(event: 'fast-reply', listener: (id: UUID, code: FastReply | number) => void): this;
  on(event: 'fast-reply', listener: (id: UUID, code: FastReply | number) => void): this;
  once(event: 'fast-reply', listener: (id: UUID, code: FastReply | number) => void): this;
  prependListener(event: 'fast-reply', listener: (id: UUID, code: FastReply | number) => void): this;
  prependOnceListener(event: 'fast-reply', listener: (id: UUID, code: FastReply | number) => void): this;
  removeListener(event: 'fast-reply', listener: (id: UUID, code: FastReply | number) => void): this;
  emit(event: 'fast-reply', id: UUID, code: FastReply | number): boolean;

  addListener(event: 'connect', listener: () => void): this;
  on(event: 'connect', listener: () => void): this;
  once(event: 'connect', listener: () => void): this;
  prependListener(event: 'connect', listener: () => void): this;
  prependOnceListener(event: 'connect', listener: () => void): this;
  removeListener(event: 'connect', listener: () => void): this;
  emit(event: 'connect'): boolean;

  addListener(event: 'close', listener: () => void): this;
  addListener(event: 'data', listener: (chunk: any) => void): this;
  addListener(event: 'end', listener: () => void): this;
  addListener(event: 'error', listener: (err: Error) => void): this;
  addListener(event: 'pause', listener: () => void): this;
  addListener(event: 'readable', listener: () => void): this;
  addListener(event: 'resume', listener: () => void): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;

  emit(event: 'close'): boolean;
  emit(event: 'data', chunk: any): boolean;
  emit(event: 'end'): boolean;
  emit(event: 'error', err: Error): boolean;
  emit(event: 'pause'): boolean;
  emit(event: 'readable'): boolean;
  emit(event: 'resume'): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;

  on(event: 'close', listener: () => void): this;
  on(event: 'data', listener: (chunk: any) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'pause', listener: () => void): this;
  on(event: 'readable', listener: () => void): this;
  on(event: 'resume', listener: () => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;

  once(event: 'close', listener: () => void): this;
  once(event: 'data', listener: (chunk: any) => void): this;
  once(event: 'end', listener: () => void): this;
  once(event: 'error', listener: (err: Error) => void): this;
  once(event: 'pause', listener: () => void): this;
  once(event: 'readable', listener: () => void): this;
  once(event: 'resume', listener: () => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;

  prependListener(event: 'close', listener: () => void): this;
  prependListener(event: 'data', listener: (chunk: any) => void): this;
  prependListener(event: 'end', listener: () => void): this;
  prependListener(event: 'error', listener: (err: Error) => void): this;
  prependListener(event: 'pause', listener: () => void): this;
  prependListener(event: 'readable', listener: () => void): this;
  prependListener(event: 'resume', listener: () => void): this;
  prependListener(event: string | symbol, listener: (...args: any[]) => void): this;

  prependOnceListener(event: 'close', listener: () => void): this;
  prependOnceListener(event: 'data', listener: (chunk: any) => void): this;
  prependOnceListener(event: 'end', listener: () => void): this;
  prependOnceListener(event: 'error', listener: (err: Error) => void): this;
  prependOnceListener(event: 'pause', listener: () => void): this;
  prependOnceListener(event: 'readable', listener: () => void): this;
  prependOnceListener(event: 'resume', listener: () => void): this;
  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;

  removeListener(event: 'close', listener: () => void): this;
  removeListener(event: 'data', listener: (chunk: any) => void): this;
  removeListener(event: 'end', listener: () => void): this;
  removeListener(event: 'error', listener: (err: Error) => void): this;
  removeListener(event: 'pause', listener: () => void): this;
  removeListener(event: 'readable', listener: () => void): this;
  removeListener(event: 'resume', listener: () => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
}

import { EventEmitter } from 'node:events';
import { UUID } from '@sockety/uuid';
import { Request as RawRequest } from '@sockety/core/src/Request';
import { ContentProducer } from '@sockety/core/src/ContentProducer';
import { StreamParser } from '@sockety/core/src/read/StreamParser';
import { RawConnectOptions, TcpSocket } from './types';
import { isTlsSocket } from '@sockety/core/src/utils/isTlsSocket';
import { StreamWriter } from '@sockety/core/src/StreamWriter';
import { FastReply } from '@sockety/core/src/constants';
import { Message } from './Message';
import { Response } from './Response';
import { UUIDHookItem, UUIDHooks } from './UUIDHooks';
import { ADD_RESPONSE_HOOK, DELETE_RESPONSE_HOOK } from './constants';
import { Request } from './Request';

const noop = () => {};

export class Connection extends EventEmitter {
  readonly #hooks = new UUIDHooks<Response | FastReply | number>();
  readonly #parser: StreamParser;
  readonly #writer: StreamWriter;
  #socket: TcpSocket | null;
  #closing = false;

  public constructor(socket: TcpSocket, options: RawConnectOptions = {}) {
    // TODO: Send connection header
    super();
    this.#socket = socket;
    this.#socket.setKeepAlive(true);
    // TODO: Support timeout

    // Prepare writer
    this.#writer = new StreamWriter(this.#socket, { maxChannels: options.maxWritableChannels });

    // Prepare reader
    this.#parser = new StreamParser({ createMessage: this.#createMessage, createResponse: this.#createResponse });
    this.#socket.pipe(this.#parser);
    this.#parser.on('message', this.#handleMessage.bind(this));
    this.#parser.on('response', this.#handleResponse.bind(this));
    this.#parser.on('fast-reply', this.#handleFastReply.bind(this));

    // Pass down socket events
    this.#socket.once('close', () => this.close(true));
    this.#socket.on('error', this.#handleError.bind(this));
    // TODO: Fix types
    this.#socket.once(isTlsSocket(this.#socket as any) ? 'secureConnect' : 'connect', this.#handleConnect.bind(this));
  }

  #createMessage = (id: UUID, action: string, dataSize: number, filesCount: number, totalFilesSize: number, hasStream: boolean, expectsResponse: boolean) => new Message(this, id, action, dataSize, filesCount, totalFilesSize, hasStream, expectsResponse);
  #createResponse = (id: UUID, parentId: UUID, dataSize: number, filesCount: number, totalFilesSize: number, hasStream: boolean, expectsResponse: boolean) => new Response(this, id, parentId, dataSize, filesCount, totalFilesSize, hasStream, expectsResponse);

  #handleConnect(): void {
    this.emit('connect');
  }

  #handleMessage(message: Message): void {
    this.emit('message', message);
  }

  #handleResponse(response: Response): void {
    // TODO: Consider emitting event too
    this.#hooks.run(response.parentId, response);
  }

  #handleFastReply(uuid: UUID, code: FastReply | number): void {
    // TODO: Consider emitting event too
    this.#hooks.run(uuid, code);
  }

  #handleError(error: any): void {
    this.emit('error', error);
  }

  public ready(): Promise<this> {
    const socket = this.#socket;
    if (!socket || socket.closed || socket.destroyed) {
      // TODO: Consider own Error class
      return Promise.reject(new Error('The connection is already closed'));
    } else if (socket.connecting) {
      return new Promise((resolve, reject) => {
        const clearListeners = () => {
          this.off('error', errorListener);
          this.off('close', closeListener);
          this.off('connect', connectListener);
        };
        const connectListener = () => {
          clearListeners();
          resolve(this);
        };
        const errorListener = (error: any) => {
          clearListeners();
          reject(error);
        };
        const closeListener = () => {
          clearListeners();
          // TODO: Consider own Error class
          reject(new Error('The connection has been closed'));
        };
        this.once('error', errorListener);
        this.once('close', closeListener);
        this.once('connect', connectListener);
      });
    }
    return Promise.resolve(this);
  }

  public send<T extends boolean>(producer: ContentProducer<RawRequest<T>>): Request<T> {
    // TODO: Avoid sending when the socket is closing
    const request = producer(this.#writer, noop, noop, true);
    return new Request<T>(this, request);
  }

  public pass(producer: ContentProducer): Promise<void> {
    // TODO: Avoid sending when the socket is closing
    return new Promise<void>((resolve, reject) => producer(this.#writer, (error) => {
      if (error == null) {
        resolve();
      } else {
        reject(error);
      }
    }, noop, false));
  }

  public async close(force = false): Promise<void> {
    // Do nothing if it's already closed
    if (!this.#socket) {
      return;
    }

    // Mark as closing
    this.#closing = true;

    // Wait until current messages will be sent if not force
    if (!force) {
      // TODO: Wait for empty stream
      // TODO: Consider sending GOAWAY
    }

    // TODO: Clear UUID hooks

    // Destroy socket
    // TODO: Abort current streams
    this.#socket.removeAllListeners();
    this.#socket.destroy();
    this.#socket = null;
    this.emit('close');
  }

  // TODO: Consider AbortSignal
  public [ADD_RESPONSE_HOOK](id: UUID, fn: (response: Response | FastReply | number) => void): UUIDHookItem {
    return this.#hooks.hook(id, fn);
  }

  public [DELETE_RESPONSE_HOOK](hook: UUIDHookItem): void {
    return this.#hooks.cancel(hook);
  }
}

export interface Connection {
  addListener(event: 'message', listener: (message: Message) => void): this;
  on(event: 'message', listener: (message: Message) => void): this;
  once(event: 'message', listener: (message: Message) => void): this;
  prependListener(event: 'message', listener: (message: Message) => void): this;
  prependOnceListener(event: 'message', listener: (message: Message) => void): this;
  removeListener(event: 'message', listener: (message: Message) => void): this;
  emit(event: 'message', message: Message): boolean;

  addListener(event: 'connect', listener: () => void): this;
  on(event: 'connect', listener: () => void): this;
  once(event: 'connect', listener: () => void): this;
  prependListener(event: 'connect', listener: () => void): this;
  prependOnceListener(event: 'connect', listener: () => void): this;
  removeListener(event: 'connect', listener: () => void): this;
  emit(event: 'connect'): boolean;

  addListener(event: 'close', listener: () => void): this;
  on(event: 'close', listener: () => void): this;
  once(event: 'close', listener: () => void): this;
  prependListener(event: 'close', listener: () => void): this;
  prependOnceListener(event: 'close', listener: () => void): this;
  removeListener(event: 'close', listener: () => void): this;
  emit(event: 'close'): boolean;

  addListener(event: 'error', listener: (error: Error) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  once(event: 'error', listener: (error: Error) => void): this;
  prependListener(event: 'error', listener: (error: Error) => void): this;
  prependOnceListener(event: 'error', listener: (error: Error) => void): this;
  removeListener(event: 'error', listener: (error: Error) => void): this;
  emit(event: 'error', error: Error): boolean;

  addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  emit(event: string | symbol, ...args: any[]): boolean;
}

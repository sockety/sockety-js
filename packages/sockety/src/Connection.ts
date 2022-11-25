import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import { UUID } from '@sockety/uuid';
import { BufferReader } from '@sockety/buffers';
import { Request as RawRequest, ContentProducer, StreamParser, StreamWriter, ControlChannelBits, FastReply } from '@sockety/core';
import { RawConnectOptions, TcpSocket } from './types';
import { Message } from './Message';
import { Response } from './Response';
import { UUIDHookItem, UUIDHookPointer, UUIDHooks } from './UUIDHooks';
import { AddResponseHook, DeleteResponseHook } from './symbols';
import { Request } from './Request';

const noop = () => {};

const createControlByteReader = new BufferReader()
  .uint8('control')
  .mask<'size', ControlChannelBits>('size', 'control', 0b00000011)
  .setInternal('size')
  .when('size', ControlChannelBits.Single, ($) => $.constant('channels', 1))
  .when('size', ControlChannelBits.Maximum, ($) => $.constant('channels', Infinity))
  .when('size', ControlChannelBits.Uint8, ($) => $.uint8('channels'))
  .when('size', ControlChannelBits.Uint16, ($) => $.uint16le('channels'))
  .end();

function createHeader(channels: number): Buffer {
  const CONTROL_BYTE = 0b11100000;
  if (channels < 1 || channels > 4096) {
    throw new Error('Invalid number of channels');
  } else if (channels === 1) {
    return Buffer.from([ CONTROL_BYTE ]);
  } else if (channels <= 256) {
    return Buffer.from([ CONTROL_BYTE | 0b00000001, channels ]);
  } else if (channels < 4096) {
    const buffer = Buffer.allocUnsafe(3);
    buffer.writeUint8(CONTROL_BYTE | 0b00000010);
    buffer.writeUint16LE(channels, 1);
    return buffer;
  } else {
    return Buffer.from([ CONTROL_BYTE | 0b00000011 ]);
  }
}

export class Connection extends EventEmitter {
  readonly #hooks = new UUIDHooks<Response | FastReply | number>();
  readonly #parser: StreamParser;
  readonly #maxWritableChannels: number;
  readonly #readControlByte = createControlByteReader({
    control: (byte) => this.#verifyControlByte(byte),
    channels: (channels) => this.#setupWriter(channels),
  }).readOne;
  readonly #heartbeatInterval: any;
  #writer!: StreamWriter;
  #socket: TcpSocket | null;
  #closing = false;
  #headersSent = false;

  public constructor(socket: TcpSocket, options: RawConnectOptions = {}) {
    super();
    this.#socket = socket;
    this.#socket.setKeepAlive(true);
    this.#maxWritableChannels = options.maxWritableChannels ?? 4096;
    const maxReceivedChannels = options.maxReceivedChannels ?? 4096;

    // Handle timeout
    const timeout = options.timeout ?? 60000;
    this.#socket.setTimeout(timeout);
    this.#heartbeatInterval = setInterval(() => this.#writer?.heartbeat(), timeout * 0.75);
    this.#socket.on('timeout', () => {
      this.emit('timeout');
      if (!this.#closing) {
        this.close(true);
      }
    });

    // Prepare reader
    this.#parser = new StreamParser({
      createMessage: this.#createMessage,
      createResponse: this.#createResponse,
      maxChannels: maxReceivedChannels,
    });
    this.#parser.on('message', this.#handleMessage.bind(this));
    this.#parser.on('response', this.#handleResponse.bind(this));
    this.#parser.on('fast-reply', this.#handleFastReply.bind(this));

    // Pass down socket events
    this.#socket.once('close', () => {
      if (!this.#closing) {
        this.close(true);
      }
    });
    this.#socket.on('error', this.#handleError.bind(this));

    // Handle control bytes
    this.#socket.write(createHeader(maxReceivedChannels));
    this.#socket.on('data', this.#readHeader.bind(this));
  }

  #createMessage = (id: UUID, action: string, dataSize: number, filesCount: number, totalFilesSize: number, hasStream: boolean, expectsResponse: boolean) => new Message(this, id, action, dataSize, filesCount, totalFilesSize, hasStream, expectsResponse);
  #createResponse = (id: UUID, parentId: UUID, dataSize: number, filesCount: number, totalFilesSize: number, hasStream: boolean, expectsResponse: boolean) => new Response(this, id, parentId, dataSize, filesCount, totalFilesSize, hasStream, expectsResponse);

  #readHeader(data: Buffer): void {
    // There should be no read
    if (!this.#socket || this.#headersSent) {
      return;
    }

    // Read control bytes
    const bytesRead = this.#readControlByte(data);

    // Pass down the rest of stream
    if (this.#headersSent) {
      this.emit('connect');
      this.#socket.removeAllListeners('data');
      if (data.length > bytesRead) {
        this.#parser._write(data.subarray(bytesRead), 'buffer', noop);
      }
      this.#socket.pipe(this.#parser);
    }
  }

  #verifyControlByte(byte: number): void {
    if ((byte >> 4) !== 0b1110) {
      this.emit('error', new Error('Invalid control byte'));
      if (this.#closing) {
        this.close(true);
      }
      return;
    }
  }

  #setupWriter(maxChannels: number): void {
    if (!this.#socket) {
      return;
    }
    this.#writer = new StreamWriter(this.#socket, {
      maxChannels: Math.min(this.#maxWritableChannels, maxChannels),
    });
    this.#headersSent = true;
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
    if (!this.#writer) {
      throw new Error('The connection is not established yet.');
    } if (this.#closing) {
      throw new Error('The connection is closed.');
    }
    const request = producer(this.#writer, noop, noop, true);
    return new Request<T>(this, request);
  }

  public pass(producer: ContentProducer): Promise<void> {
    if (!this.#writer) {
      throw new Error('The connection is not established yet.');
    } else if (this.#closing) {
      throw new Error('The connection is closed.');
    }
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

    // Stop sending heartbeats
    clearInterval(this.#heartbeatInterval);

    // Wait until current messages will be sent if not force
    if (!force) {
      // TODO: Wait for empty stream
      // TODO: Consider sending GOAWAY
    }

    // TODO: Clear UUID hooks

    // Destroy socket
    // TODO: Abort current streams
    this.#writer?.destroy();
    this.#socket.removeAllListeners();
    this.#socket.destroy();
    this.#socket = null;
    this.emit('close');
  }

  // TODO: Consider AbortSignal
  public [AddResponseHook](id: UUID, fn: (response: Response | FastReply | number) => void): UUIDHookPointer {
    return this.#hooks.hook(id, fn);
  }

  public [DeleteResponseHook](pointer: UUIDHookPointer): void {
    return this.#hooks.cancel(pointer);
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

  addListener(event: 'timeout', listener: () => void): this;
  on(event: 'timeout', listener: () => void): this;
  once(event: 'timeout', listener: () => void): this;
  prependListener(event: 'timeout', listener: () => void): this;
  prependOnceListener(event: 'timeout', listener: () => void): this;
  removeListener(event: 'timeout', listener: () => void): this;
  emit(event: 'timeout'): boolean;

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

import { EventEmitter } from 'node:events';
import type * as net from 'node:net';
import type * as tls from 'node:tls';
import { isTlsSocket } from './utils/isTlsSocket';
import { ContentProducer } from './ContentProducer';
import { Request } from './Request';
import { SocketWriter } from './SocketWriter';
import { StreamParser } from './read/StreamParser';

type RawSocket = tls.TLSSocket | net.Socket;

// TODO: Add event types
// TODO: Extract reading and messages out of socket?
export class Socket extends EventEmitter {
  readonly #writer: SocketWriter;
  readonly #parser: StreamParser;
  #socket: RawSocket | null;
  #closing = false;

  public constructor(socket: RawSocket) {
    super();

    // Set up socket
    this.#socket = socket;
    this.#socket.setKeepAlive(true);
    this.#writer = new SocketWriter(this.#socket, 4095);
    this.#parser = new StreamParser();

    // Pass events down
    socket.pipe(this.#parser);
    this.#parser.on('message', (message) => this.emit('message', message));
    this.#parser.on('ack', (uuid) => this.emit('ack', uuid));
    this.#parser.on('revoke', (uuid) => this.emit('revoke', uuid));
    this.#socket.once('close', () => this.close(true));
    this.#socket.on('error', (error) => this.emit('error', error));
    this.#socket.once(isTlsSocket(this.#socket) ? 'secureConnect' : 'connect', () => this.emit('connect'));
  }

  public pass(producer: ContentProducer): Promise<void> {
    return new Promise<void>((resolve, reject) => producer(this.#writer, false, (error) => {
      if (error == null) {
        resolve();
      } else {
        reject(error);
      }
    }));
  }

  public send<T extends Request<any>>(producer: ContentProducer<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => producer(this.#writer, true, (error, message) => {
      if (error == null) {
        resolve(message!);
      } else {
        reject(error);
      }
    }));
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

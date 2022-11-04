import { EventEmitter } from 'node:events';
import { ListenOptions } from 'node:net';
import { RawServerOptions, TcpServer, TcpSocket } from './types';
import { Connection } from './Connection';

export class Server extends EventEmitter {
  readonly #server: TcpServer;
  readonly #options: RawServerOptions;

  public constructor(rawServer: TcpServer, options: RawServerOptions = {}) {
    super();
    this.#server = rawServer;
    this.#options = options;
    this.#server.on('connection', this.#handleSocket.bind(this));
    this.#server.on('secureConnection', this.#handleSocket.bind(this));
    this.#server.on('error', this.#handleError.bind(this));
    this.#server.on('close', this.#handleClose.bind(this));
  }

  #handleError(error: any): void {
    this.emit('error', error);
  }

  #handleSocket(rawSocket: TcpSocket): void {
    this.emit('connection', new Connection(rawSocket, this.#options));
  }

  #handleClose(): void {
    this.emit('close');
  }

  public get listening(): boolean {
    return this.#server.listening;
  }

  public get connections(): number {
    return this.#server.connections;
  }

  public get maxConnections(): number {
    return this.#server.maxConnections;
  }

  public set maxConnections(maxConnections: number) {
    this.#server.maxConnections = maxConnections;
  }

  public getConnections(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.#server.getConnections((error, count) => {
        if (error == null) {
          resolve(count);
        } else {
          reject(error);
        }
      });
    });
  }

  public listen(port: number, hostname?: string, backlog?: number): Promise<this>;
  public listen(port: number, hostname?: string): Promise<this>;
  public listen(port: number, backlog?: number): Promise<this>;
  public listen(port: number): Promise<this>;
  public listen(path: string, backlog?: number): Promise<this>;
  public listen(path: string): Promise<this>;
  public listen(options: ListenOptions): Promise<this>;
  public listen(handle: any, backlog?: number): Promise<this>;
  public listen(handle: any): Promise<this>;
  public listen(...args: any): Promise<this> {
    return new Promise((resolve, reject) => {
      const clearListeners = () => {
        this.#server.off('error', errorListener);
        this.#server.off('listening', startListener);
      }
      const errorListener = (error: any) => {
        clearListeners();
        reject(error);
      };
      const startListener = () => {
        clearListeners();
        resolve(this);
      };
      this.#server.on('error', errorListener);
      this.#server.on('listening', startListener);
      this.#server.listen(...args);
    });
  }

  public close(): Promise<this> {
    // TODO: Consider GOAWAY on all sockets?
    return new Promise((resolve, reject) => {
      this.#server.close((error) => {
        if (error == null) {
          resolve(this);
        } else {
          reject(error);
        }
      })
    });
  }

  public ref(): this {
    this.#server.ref();
    return this;
  }

  public unref(): this {
    this.#server.unref();
    return this;
  }
}

export interface Server {
  addListener(event: 'connection', listener: (connection: Connection) => void): this;
  on(event: 'connection', listener: (connection: Connection) => void): this;
  once(event: 'connection', listener: (connection: Connection) => void): this;
  prependListener(event: 'connection', listener: (connection: Connection) => void): this;
  prependOnceListener(event: 'connection', listener: (connection: Connection) => void): this;
  removeListener(event: 'connection', listener: (connection: Connection) => void): this;
  emit(event: 'connection', connection: Connection): boolean;

  addListener(event: 'error', listener: (error: any) => void): this;
  on(event: 'error', listener: (error: any) => void): this;
  once(event: 'error', listener: (error: any) => void): this;
  prependListener(event: 'error', listener: (error: any) => void): this;
  prependOnceListener(event: 'error', listener: (error: any) => void): this;
  removeListener(event: 'error', listener: (error: any) => void): this;
  emit(event: 'error', error: any): boolean;

  addListener(event: 'close', listener: () => void): this;
  on(event: 'close', listener: () => void): this;
  once(event: 'close', listener: () => void): this;
  prependListener(event: 'close', listener: () => void): this;
  prependOnceListener(event: 'close', listener: () => void): this;
  removeListener(event: 'close', listener: () => void): this;
  emit(event: 'close'): boolean;
}

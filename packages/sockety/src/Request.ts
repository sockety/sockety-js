import { Request as RawRequest, FastReply } from '@sockety/core';
import { UUID } from '@sockety/uuid';
import { Connection } from './Connection';
import { Response } from './Response';
import { AddResponseHook, DeleteResponseHook } from './symbols';

// TODO: Rename original Request class
export class Request<Stream = true | false> {
  readonly #connection: Connection;
  readonly #request: RawRequest<Stream>;

  public constructor(connection: Connection, request: RawRequest<Stream>) {
    this.#connection = connection;
    this.#request = request;
  }

  public get id(): UUID {
    return this.#request.id;
  }

  public isSent(): boolean {
    return this.#request.isDone();
  }

  public response(): Promise<Response | FastReply | number> {
    return new Promise((resolve, reject) => {
      // TODO: Hook to send error / connection error as well?
      const hook = this.#connection[AddResponseHook](this.id, (response) => {
        this.#connection[DeleteResponseHook](hook);
        resolve(response);
      });
    });
  }

  // TODO: public responses()

  public sent(): Promise<this> {
    return this.#request.done().then(() => this);
  }
}

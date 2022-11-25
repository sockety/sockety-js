import { UUID } from '@sockety/uuid';
import { RequestStream } from './RequestStream';
import { RequestDone } from './symbols';

export class Request<Stream = true | false> {
  public readonly id: UUID;
  public readonly stream: Stream extends true ? RequestStream : null;

  #done = false;
  #error: Error | undefined;

  #donePromise: Promise<this> | undefined;
  #doneResolve: (() => void) | undefined;
  #doneReject: ((error: any) => void) | undefined;

  public constructor(id: UUID, stream: Stream extends true ? RequestStream : null) {
    this.id = id;
    this.stream = stream;
  }

  public isDone(): boolean {
    return this.#done;
  }

  // TODO: Consider if it's worth to cache promise
  public done(): Promise<this> {
    if (this.#donePromise) {
      return this.#donePromise;
    } else if (this.#done) {
      return this.#error == null ? Promise.resolve(this) : Promise.reject(this.#error);
    } else {
      this.#donePromise = new Promise((resolve, reject) => {
        this.#doneResolve = () => resolve(this);
        this.#doneReject = reject;
      });
      return this.#donePromise;
    }
  }

  public [RequestDone](error: Error | null | undefined): void {
    this.#done = true;
    if (error) {
      this.#error = error;
      if (this.#doneReject) {
        this.#doneReject(error);
      }
    } else if (this.#doneResolve) {
      this.#doneResolve();
    }
  }

  // TODO: Add "Started" property when it will be created before sending
  // TODO: Add helper to abort
  // TODO: Add handlers to watch for load
  // TODO: Not here: Add handlers to generate ACK/REVOKE?
  // TODO: Add helpers to watch for ack/revoke?
}

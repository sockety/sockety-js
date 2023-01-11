import { Writable } from 'node:stream';

export class DrainListener {
  readonly #writable: Writable;
  #listeners: (() => void)[] = [];

  public constructor(writable: Writable) {
    this.#writable = writable;
    writable.on('drain', this.#drained);
  }

  get #isWritable(): boolean {
    return !this.#writable.writableNeedDrain;
  }

  public listen(fn: () => void): void {
    this.#listeners.push(fn);
  }

  public destroy(): void {
    this.#listeners = [];
    this.#writable.removeListener('drain', this.#drained);
  }

  #drained = () => {
    if (this.#listeners.length === 0) {
      return;
    }
    do {
      this.#listeners.shift()!();
    } while (this.#listeners.length > 0 && this.#isWritable);
  };
}

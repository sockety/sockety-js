import { Writable } from 'node:stream';

// TODO: Destroy
export class DrainListener {
  readonly #writable: Writable;
  readonly #listeners: (() => void)[] = [];

  public constructor(writable: Writable) {
    this.#writable = writable;
    writable.on('drain', this.#drained.bind(this));
  }

  get #isWritable(): boolean {
    return !this.#writable.writableNeedDrain;
  }

  public listen(fn: () => void): void {
    this.#listeners.push(fn);
  }

  #drained() {
    if (this.#listeners.length === 0) {
      return;
    }
    do {
      this.#listeners.shift()!();
    } while (this.#listeners.length > 0 && this.#isWritable);
  }
}

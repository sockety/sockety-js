type Callback = (error: Error | null | undefined) => void;

export class AggregatedCallback {
  #listeners: Callback[] | undefined = [];
  #error: Error | null | undefined = undefined;

  public add(callback?: Callback): void {
    if (!callback) {
      return;
    } else if (this.#listeners) {
      this.#listeners.push(callback);
    } else {
      process.nextTick(() => callback(this.#error));
    }
  }

  public readonly callback: Callback = (error) => {
    if (!this.#listeners) {
      return;
    }
    this.#error = error;
    const listeners = this.#listeners;
    this.#listeners = undefined;

    listeners.forEach((listener) => listener(error));
  };

  public static done(error: Error | null | undefined): AggregatedCallback {
    const callback = new AggregatedCallback();
    callback.callback(error);
    return callback;
  }
}

import { UUID } from '@sockety/uuid';
import { UUID_VALUE } from '@sockety/uuid/src/UUID';

export class UUIDHookItem<T = any> {
  public next: UUIDHookItem<T> | undefined;
  public prev: UUIDHookItem<T> | undefined;
  public id: UUID;
  public hook: (value: T) => void;

  public constructor(id: UUID, hook: (value: T) => void, next: UUIDHookItem<T> | undefined) {
    this.id = id;
    this.hook = hook;
    this.next = next;
    if (next) {
      next.prev = this;
    }
  }

  public extend(hook: (value: T) => void): void {
    const prev = this.hook;
    this.hook = (value: T) => {
      prev(value);
      hook(value);
    };
  }
}

export class UUIDHooks<T = any> {
  readonly #buckets: (UUIDHookItem<T> | undefined)[] = new Array(255);

  #bucket(id: UUID): number {
    return id[UUID_VALUE][0];
  }

  #get(id: UUID): UUIDHookItem<T> | undefined {
    let item = this.#buckets[this.#bucket(id)];
    while (item !== undefined && !item.id.equals(id)) {
      item = item.next;
    }
    return item;
  }

  // TODO: Consider abort signal
  public hook(id: UUID, hook: (value: T) => void): UUIDHookItem<T> {
    // TODO: It should return something to allow to cancel hook
    const previous = this.#get(id);
    if (previous) {
      previous.extend(hook);
      return previous;
    } else {
      const bucket = this.#bucket(id);
      const item = new UUIDHookItem<T>(id, hook, this.#buckets[bucket]);
      this.#buckets[bucket] = item;
      return item;
    }
  }

  public cancel(item: UUIDHookItem<T>): void {
    // TODO: It should cancel only single hook
    if (item.prev) {
      item.prev.next = item.next;
      if (item.next) {
        item.next.prev = item.prev;
      }
    } else {
      const bucket = this.#bucket(item.id);
      this.#buckets[bucket] = item.next;
      if (item.next) {
        item.next.prev = undefined;
      }
    }
  }

  public run(id: UUID, data: T): void {
    const item = this.#get(id);
    if (item !== undefined) {
      item.hook(data);
    }
  }
}

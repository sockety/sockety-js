/* eslint-disable max-classes-per-file, no-use-before-define */

import { UUID } from './UUID';
import { UuidValue } from './internal/symbols';

const noop = () => {};

declare const HookPointerOpaqueSymbol: unique symbol;
export type UUIDHookPointer<T = any> = [ UUIDHookItem<T>, number ] & { [HookPointerOpaqueSymbol]: true };

export class UUIDHookItem<T = any> {
  public next: UUIDHookItem<T> | undefined;
  public prev: UUIDHookItem<T> | undefined;
  public id: UUID;
  public hooks: ((value: T) => void)[];
  public activeHooksCount = 1;

  public constructor(id: UUID, hook: (value: T) => void, next: UUIDHookItem<T> | undefined) {
    this.id = id;
    this.hooks = [ hook ];
    this.next = next;
    if (next) {
      next.prev = this;
    }
  }

  public hook(value: T): void {
    for (let i = 0; i < this.hooks.length; i++) {
      this.hooks[i](value);
    }
  }

  public extend(hook: (value: T) => void): number {
    this.activeHooksCount++;
    return this.hooks.push(hook) - 1;
  }

  public cancel(index: number): boolean {
    if (this.hooks[index] !== noop) {
      this.hooks[index] = noop;
      this.activeHooksCount--;
    }
    return this.activeHooksCount === 0;
  }
}

export class UUIDHooks<T = any> {
  readonly #buckets: (UUIDHookItem<T> | undefined)[] = new Array(255);

  #bucket(id: UUID): number {
    return id[UuidValue][0];
  }

  #get(id: UUID): UUIDHookItem<T> | undefined {
    let item = this.#buckets[this.#bucket(id)];
    while (item !== undefined && !item.id.equals(id)) {
      item = item.next;
    }
    return item;
  }

  // TODO: Consider abort signal
  public hook(id: UUID, hook: (value: T) => void): UUIDHookPointer<T> {
    const previous = this.#get(id);
    if (previous) {
      return [ previous, previous.extend(hook) ] as UUIDHookPointer<T>;
    } else {
      const bucket = this.#bucket(id);
      const item = new UUIDHookItem<T>(id, hook, this.#buckets[bucket]);
      this.#buckets[bucket] = item;
      return [ item, 0 ] as UUIDHookPointer<T>;
    }
  }

  public cancelAll(item: UUIDHookItem<T>): void {
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

  public cancel([ item, index ]: UUIDHookPointer<T>): void {
    if (item.cancel(index)) {
      this.cancelAll(item);
    }
  }

  public run(id: UUID, data: T): void {
    const item = this.#get(id);
    if (item !== undefined) {
      item.hook(data);
    }
  }
}

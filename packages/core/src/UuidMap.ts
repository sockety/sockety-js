import { UUID } from '@sockety/uuid';
import { UUID_VALUE } from '@sockety/uuid/src/UUID';

class UUIDMapItem<V> {
  public next: UUIDMapItem<V> | undefined;
  public uuid: UUID;
  public value: V;

  public constructor(uuid: UUID, value: V, next: UUIDMapItem<V> | undefined) {
    this.uuid = uuid;
    this.value = value;
    this.next = next;
  }
}

// TODO: GC
// TODO: In real case, allow timeout for waiting and GC
// TODO: Consider moving to @sockety/uuid package
export class UUIDMap<V = any> {
  #buckets: (UUIDMapItem<V> | undefined)[] = new Array(255);

  // #find(uuid: UUID): UUIDMapItem<V> | undefined {
  //   let item = this.#first;
  //   while (item !== null) {
  //     if (uuid.equals(item.uuid)) {
  //       return item;
  //     }
  //     item = item.next;
  //   }
  // }

  #findPrevious(uuid: UUID): UUIDMapItem<V> | undefined {
    let prev: UUIDMapItem<V> | undefined = undefined;
    let item = this.#buckets[uuid[UUID_VALUE][0]];
    while (item !== undefined) {
      if (uuid.equals(item.uuid)) {
        return prev;
      }
      prev = item;
      item = item.next;
    }
  }

  public set(uuid: UUID, value: V): void {
    const bucket = uuid[UUID_VALUE][0];
    // Return object/callback for fast deletion?
    // TODO: Don't assume that it's set only once
    this.#buckets[bucket] = new UUIDMapItem<V>(uuid, value, this.#buckets[bucket]);
  }

  public has(uuid: UUID): boolean {
    const first = this.#buckets[uuid[UUID_VALUE][0]];
    return first !== undefined && (first.uuid.equals(uuid) || !!this.#findPrevious(uuid));
  }

  public get(uuid: UUID): V | undefined {
    const bucket = uuid[UUID_VALUE][0];
    const first = this.#buckets[bucket];
    if (first === undefined) {
      return;
    } else if (first.uuid.equals(uuid)) {
      const value = first.value;
      this.#buckets[bucket] = first.next;
      return value;
    }
    const prev = this.#findPrevious(uuid);
    if (prev !== undefined) {
      const value = prev.next!.value;
      prev.next = prev.next!.next;
      return value;
    }


    // const item = this.#find(uuid);
    // if (item !== undefined) {
    //   // Delete item
    //   if (item.next) {
    //     item.next.previous = item.previous;
    //   }
    //   if (item.previous) {
    //     item.previous.next = item.next;
    //   } else {
    //     this.#first = item.next;
    //   }
    //
    //   // Return value
    //   return item.value;
    // }
  }
}

import { UUID } from '@sockety/uuid';

class UUIDMapItem<V> {
  public next: UUIDMapItem<V> | null;
  public uuid: UUID;
  public value: V;

  public constructor(uuid: UUID, value: V, next: UUIDMapItem<V> | null) {
    this.uuid = uuid;
    this.value = value;
    this.next = next;
    // if (next) {
    //   this.previous = next;
    // }
  }
}

// TODO: GC
// TODO: In real case, allow timeout for waiting and GC
export class UUIDMap<V = any> {
  #first: UUIDMapItem<V> | null = null;

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
    let item = this.#first;
    while (item !== null) {
      if (uuid.equals(item.uuid)) {
        return prev;
      }
      prev = item;
      item = item.next;
    }
  }

  public set(uuid: UUID, value: V): void {
    // Return object/callback for fast deletion?
    // TODO: Don't assume that it's set only once
    this.#first = new UUIDMapItem<V>(uuid, value, this.#first);
  }

  public has(uuid: UUID): boolean {
    return this.#first !== null && (this.#first.uuid.equals(uuid) || !!this.#findPrevious(uuid));
  }

  public get(uuid: UUID): V | undefined {
    if (this.#first === null) {
      return;
    } else if (this.#first.uuid.equals(uuid)) {
      const value = this.#first.value;
      this.#first = this.#first.next;
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

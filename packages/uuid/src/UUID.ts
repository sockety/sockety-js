import { hexBytes } from './internal/hexBytes';

export class UUID {
  readonly #value: number[];

  public constructor(buffer: Uint8Array | number[], offset = 0) {
    if (typeof buffer[offset + 15] === 'undefined') {
      throw new Error('Out of bounds: can not read UUID.');
    }
    this.#value = [
      buffer[offset],
      buffer[offset + 1],
      buffer[offset + 2],
      buffer[offset + 3],
      buffer[offset + 4],
      buffer[offset + 5],
      (buffer[offset + 6] & 0x0f) | 0x40,
      buffer[offset + 7],
      (buffer[offset + 8] & 0x3f) | 0x80,
      buffer[offset + 9],
      buffer[offset + 10],
      buffer[offset + 11],
      buffer[offset + 12],
      buffer[offset + 13],
      buffer[offset + 14],
      buffer[offset + 15],
    ];
  }

  /**
   * Build a string representation of UUID.
   */
  public toString(): string {
    const value = this.#value;
    return (
      hexBytes[value[0]] + hexBytes[value[1]] +
      hexBytes[value[2]] + hexBytes[value[3]] + '-' +
      hexBytes[value[4]] + hexBytes[value[5]] + '-' +
      hexBytes[value[6]] + hexBytes[value[7]] + '-' +
      hexBytes[value[8]] + hexBytes[value[9]] + '-' +
      hexBytes[value[10]] + hexBytes[value[11]] +
      hexBytes[value[12]] + hexBytes[value[13]] +
      hexBytes[value[14]] + hexBytes[value[15]]
    );
  }

  /**
   * Serialize to JSON as a string representation.
   */
  public toJSON(): string {
    return this.toString();
  }

  /**
   * Write UUID to buffer on selected position.
   */
  public write(buffer: Uint8Array, offset = 0): void {
    for (let i = 0; i < 16; i++) {
      buffer[offset + i] = this.#value[i];
    }
  }
}

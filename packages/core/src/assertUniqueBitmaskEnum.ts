export function assertUniqueBitmaskEnum<T extends Record<any, number | string>>(mask: number, data: T): void {
  const occurrences: Record<string | number, boolean> = {};
  for (const [ key, value ] of Object.entries(data)) {
    if (typeof value === 'string') {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (occurrences[value]) {
      throw new Error(`Value ${value} (${key}) is duplicated`);
    }
    occurrences[value] = true;
    if ((value & mask) !== value) {
      throw new Error(`Value ${value} (${key}) is not within bitmask 0b${mask.toString(2)}`);
    }
  }
}

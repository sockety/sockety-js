import { JsonValue } from 'type-fest';

export function convertValueToCode(value: JsonValue | undefined): string {
  if (value === undefined) {
    return 'undefined';
  } else if (value === null) {
    return 'null';
  } else if (value === Infinity) {
    return 'Infinity';
  } else if (value === -Infinity) {
    return '-Infinity';
  }

  return JSON.stringify(value);
}

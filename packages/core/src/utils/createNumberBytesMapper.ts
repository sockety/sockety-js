import { JsonValue } from 'type-fest';

export function createNumberBytesMapper<T extends JsonValue>(
  name: string,
  bytesMap: Record<number, T>,
): (value: number) => T {
  const available = Object.keys(bytesMap).map((bytes) => parseInt(bytes, 10));
  const code = available
    .map((bytes) => `if(value<=${parseInt('ff'.repeat(bytes) || '0', 16)}){return ${JSON.stringify(bytesMap[bytes])}}`)
    .join('else ');
  const raise = `else{throw new Error("The '" + ${JSON.stringify(name)} + "' value is too big");}`;
  return new Function('value', `${code}${raise}`) as (value: number) => T;
}

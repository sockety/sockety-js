export function createNumberBytesMapper(name: string, bytesMap: Record<number, number>): (value: number) => number {
  const available = Object.keys(bytesMap).map((bytes) => parseInt(bytes, 10));
  const code = available
    .map((bytes) => `if(value<=${parseInt('ff'.repeat(bytes) || '0', 16)}){return ${bytesMap[bytes]}}`)
    .join('else ');
  const raise = `else{throw new Error("The '" + ${JSON.stringify(name)} + "' value is too big");}`;
  return new Function('value', `${code}${raise}`) as (value: number) => number;
}

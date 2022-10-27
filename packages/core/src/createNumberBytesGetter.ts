export function createNumberBytesGetter(name: string, available: number[]): (value: number) => number {
  available = available.slice().sort();
  const code = available
    .map((bytes) => `if(value<=${parseInt('ff'.repeat(bytes) || '0', 16)}){return ${bytes}}`)
    .join('else ');
  const raise = `else{throw new Error("The '" + ${JSON.stringify(name)} + "' value is too big");}`;
  return new Function('value', `${code}${raise}`) as (value: number) => number;
}

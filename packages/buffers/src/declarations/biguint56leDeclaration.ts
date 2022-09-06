import { createDeclaration } from '../createDeclaration';

export const biguint56leDeclaration = createDeclaration({
  read: () => (operation) => operation
    .initialValue(0)
    .resetValue(false)
    .declare('offset', '0')
    .declare('parts', '[ 0, 0, 0, 0, 0, 0, 0 ]', false)

    .entry(($) => `
      if (${$.hasBytes(7)}) {
        ${$.set(`BigInt((
          ${$.bufferAt(0)} |
          ${$.bufferAt(1, 8)} |
          ${$.bufferAt(2, 16)}) +
          ${$.bufferAt(3, 24)}
        ) + (BigInt(
          ${$.bufferAt(4)} |
          ${$.bufferAt(5, 8)} |
          ${$.bufferAt(6, 16)}
        ) << 32n)`)}
        ${$.moveOffset(7)}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        ${$.go('next')}
      }
      ${$.escape()}
    `)

    .snippet('next', ($) => `
      let left = ${$.end} - ${$.offset};
      do {
        if (left === 0 || typeof ${$.bufferAt(0)} === 'undefined') {
          ${$.escape()}
        }
        left--;
        parts[offset++] = ${$.buffer}[${$.offset}++];
      } while (offset < 7);
      
      ${$.set(`BigInt((
        parts[0] |
        ${$.shift('parts[1]', 8)} |
        ${$.shift('parts[2]', 16)}) +
        ${$.shift('parts[3]', 24)}
      ) + (BigInt(
        parts[4] |
        ${$.shift('parts[5]', 8)} |
        ${$.shift('parts[6]', 16)}
      ) << 32n)`)}
      ${$.continue()}
    `),
});

import { createDeclaration } from '../createDeclaration';

export const uint40leDeclaration = createDeclaration({
  read: () => (operation) => operation
    .initialValue(0)
    .resetValue(false)
    .declare('offset', '0')
    .declare('parts', '[ 0, 0, 0, 0, 0 ]', false)

    .entry(($) => `
      if (${$.hasBytes(5)}) {
        ${$.set(`((
          ${$.bufferAt(0)} |
          ${$.bufferAt(1, 8)} |
          ${$.bufferAt(2, 16)}) +
          ${$.bufferAt(3, 24)} +
          ${$.bufferAt(4, 32)}
        )`)}
        ${$.moveOffset(5)}
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
      } while (offset < 5);
      
      ${$.set(`((
        parts[0] |
        ${$.shift('parts[1]', 8)} |
        ${$.shift('parts[2]', 16)}) +
        ${$.shift('parts[3]', 24)} +
        ${$.shift('parts[4]', 32)}
      )`)}
      ${$.continue()}
    `),
});

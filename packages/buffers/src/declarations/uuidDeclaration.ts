import { createDeclaration } from '../createDeclaration';

export const uuidDeclaration = createDeclaration({
  read: () => (operation) => operation
    .initialValue('""')
    .resetValue(false)
    .header('const { readUuid } = require("@sockety/uuid");')
    .declare('offset', '0')
    .declare('parts', '[ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]', false)

    .entry(($) => `
      if (${$.hasBytes(16)}) {
        ${$.set(`readUuid(${$.buffer}, ${$.offset})`)}
        ${$.moveOffset(16)}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        ${$.go('next')}
      }
      ${$.escape()}
    `)

    .snippet('next', ($) => `
      const parts = ${$.local('parts')};
      let left = ${$.end} - ${$.offset};
      do {
        if (left === 0 || typeof ${$.bufferAt(0)} === 'undefined') {
          ${$.escape()}
        }
        left--;
        parts[${$.local('offset')}++] = ${$.buffer}[${$.offset}++];
      } while (${$.local('offset')} < 16);
      
      ${$.set('readUuid(parts)')}
      ${$.continue()}
    `),
});

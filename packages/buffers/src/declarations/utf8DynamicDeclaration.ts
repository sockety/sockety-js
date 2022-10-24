import { createDeclaration } from '../createDeclaration';

export const utf8DynamicDeclaration = createDeclaration({
  read: (lengthKey: string) => (operation) => operation
    .initialValue('""')
    .resetValue(true)
    .declare('left', 0, false)
    .declare('parts', '[]')

    .header(`function concat(buffers) {
      let size = buffers.reduce((acc, x) => acc + x.length, 0);
      /* FastBuffer will be below (Buffer.poolSize >>> 1) */
      if (size >= 4096) {
        return Buffer.concat(buffers);
      }
      const result = Buffer.allocUnsafe(size);
      const buffersCount = buffers.length;
      let offset = 0;
      for (let i = 0; i < buffersCount; i++) {
        const buffer = buffers[i];
        const bufferLength = buffer.length;
        for (let j = 0; j < bufferLength; j++) {
          result[offset++] = buffer[j];
        }
      }
      return result;
    }`)

    .entry(($) => `
      const length = Number(${$.read(lengthKey)});
      if (length === 0) {
        ${$.set('""')}
        ${$.continue()}
      } else if (${$.hasBytes('length')}) {
        ${$.set(`${$.buffer}.subarray(${$.offset}, ${$.offset} + length).toString()`)}
        ${$.moveOffset('length')}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        part = ${$.buffer}.subarray(${$.offset}, ${$.end});
        const partLength = part.length;
        parts = [ part ];
        ${$.local('left')} = length - partLength;
        ${$.moveOffset('partLength')}
        ${$.escape('next')}
      } else {
        ${$.escape()}
      }
    `)

    .snippet('next', ($) => `
      const parts = ${$.local('parts')};
      const left = ${$.local('left')};
      if (${$.hasBytes('left')}) {
        parts.push(${$.buffer}.subarray(${$.offset}, ${$.offset} + left));
        ${$.set('concat(parts).toString()')}
        ${$.moveOffset('left')}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        const part = ${$.buffer}.subarray(${$.offset}, ${$.end});
        const partLength = part.length;
        parts.push(part);
        ${$.local('left')} -= partLength;
        ${$.moveOffset('partLength')}
        ${$.escape()}
      } else {
        ${$.escape()}
      }
    `),
});

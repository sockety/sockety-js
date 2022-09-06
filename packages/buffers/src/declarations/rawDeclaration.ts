import { createDeclaration } from '../createDeclaration';

export const rawDeclaration = createDeclaration({
  read: (length: number) => (operation) => operation
    .initialValue('Buffer.allocUnsafe(0)')
    .resetValue(true)
    .declare('NONE', 'Buffer.allocUnsafe(0)', false)
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

    .entry(length === 0
      ? ($) => `${$.set('NONE')} ${$.continue()}`
      : ($) => `
      if (${$.hasBytes(length)}) {
        ${$.set(`${$.buffer}.subarray(${$.offset}, ${$.offset} + ${length})`)}
        ${$.moveOffset(length)}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        const part = ${$.buffer}.subarray(${$.offset}, ${$.end});
        const partLength = part.length;
        parts = [ part ];
        left = ${length} - partLength;
        ${$.moveOffset('partLength')}
        ${$.escape('next')}
      } else {
        ${$.escape()}
      }
    `)

    .snippet('next', ($) => `
      if (${$.hasBytes('left')}) {
        parts.push(${$.buffer}.subarray(${$.offset}, ${$.offset} + left));
        ${$.set('concat(parts)')}
        ${$.moveOffset('left')}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        const part = ${$.buffer}.subarray(${$.offset}, ${$.end});
        const partLength = part.length;
        parts.push(part);
        left -= partLength;
        ${$.moveOffset('partLength')}
        ${$.escape()}
      } else {
        ${$.escape()}
      }
    `),
});

export const rawDeclarationContinuous = createDeclaration({
  read: (length: number) => (operation) => operation
    .initialValue('Buffer.allocUnsafe(0)')
    .resetValue(true)
    .declare('NONE', 'Buffer.allocUnsafe(0)', false)
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

    .entry(length === 0
      ? ($) => `${$.set('NONE')} ${$.continue()}`
      : ($) => `
      if (${$.hasBytes(length)}) {
        ${$.set(`${$.buffer}.subarray(${$.offset}, ${$.offset} + length)`)}
        ${$.moveOffset(length)}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        const part = ${$.buffer}.subarray(${$.offset}, ${$.end});
        const partLength = part.length;
        ${$.onlyWhenUsed('parts = [ part ];')}
        ${$.emit('part')};
        left = ${length} - partLength;
        ${$.moveOffset('partLength')}
        ${$.escape('next')}
      } else {
        ${$.escape()}
      }
    `)

    .snippet('next', ($) => `
      if (${$.hasBytes('left')}) {
        const part = ${$.buffer}.subarray(${$.offset}, ${$.offset} + left);
        ${$.onlyWhenUsed('parts.push(part);')}
        ${$.set('concat(parts)', false)}
        ${$.emit('part')}
        ${$.moveOffset('left')}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        const part = ${$.buffer}.subarray(${$.offset}, ${$.end});
        const partLength = part.length;
        ${$.onlyWhenUsed('parts.push(part);')}
        ${$.emit('part')}
        left -= partLength;
        ${$.moveOffset('partLength')}
        ${$.escape()}
      } else {
        ${$.escape()}
      }
    `),
});

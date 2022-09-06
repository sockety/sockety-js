import { createDeclaration } from '../createDeclaration';

export const uint32leDeclaration = createDeclaration({
  read: () => (operation) => operation
    .initialValue(0)
    .resetValue(false)
    .declare('temp', 0, false)

    .entry(($) => `
      if (${$.hasBytes(4)}) {
        ${$.set(`(
          ${$.bufferAt(0)} |
          ${$.bufferAt(1, 8)} |
          ${$.bufferAt(2, 16)} +
          ${$.bufferAt(3, 24)}
        )`)}
        ${$.moveOffset(4)}
        ${$.continue()}
      } else if (${$.hasBytes(3)}) {
        temp = ${$.bufferAt(0)} | ${$.bufferAt(1, 8)} | ${$.bufferAt(2, 16)};
        ${$.moveOffset(3)}
        ${$.escape('left_1')}
      } else if (${$.hasBytes(2)}) {
        temp = ${$.bufferAt(0)} | ${$.bufferAt(1, 8)};
        ${$.moveOffset(2)}
        ${$.escape('left_2')}
      } else if (${$.hasBytes()}) {
        temp = ${$.bufferAt(0)};
        ${$.moveOffset(1)}
        ${$.escape('left_3')}
      }
      ${$.escape()}
    `)

    .snippet('left_3', ($) => `
      if (${$.hasBytes(3)}) {
        ${$.set(`(
          temp |
          ${$.bufferAt(0, 8)} |
          ${$.bufferAt(1, 16)} +
          ${$.bufferAt(2, 24)}
        )`)}
        ${$.moveOffset(3)}
        ${$.continue()}
      } else if (${$.hasBytes(2)}) {
        temp = temp | ${$.bufferAt(0, 8)} | ${$.bufferAt(1, 16)};
        ${$.moveOffset(2)}
        ${$.escape('left_1')}
      } else if (${$.hasBytes(1)}) {
        temp = temp | ${$.bufferAt(0, 8)};
        ${$.moveOffset(1)}
        ${$.escape('left_2')}
      }
      ${$.escape()}
    `)

    .snippet('left_2', ($) => `
      if (${$.hasBytes(2)}) {
        ${$.set(`(temp | ${$.bufferAt(0, 16)}) + (${$.bufferAt(1, 24)})`)}
        ${$.moveOffset(2)}
        ${$.continue()}
      } else if (${$.hasBytes(1)}) {
        temp = temp | ${$.bufferAt(0, 16)};
        ${$.moveOffset(1)}
        ${$.escape('left_1')}
      }
      ${$.escape()}
    `)

    .snippet('left_1', ($) => `
      if (!${$.hasBytes()}) {
        ${$.set(`temp + (${$.bufferAt(0, 24)})`)}
        ${$.moveOffset(1)}
        ${$.continue()}
      }
      ${$.escape()}
    `),
});

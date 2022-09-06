import { createDeclaration } from '../createDeclaration';

export const uint24leDeclaration = createDeclaration({
  read: () => (operation) => operation
    .initialValue(0)
    .resetValue(false)
    .declare('temp', 0, false)

    .entry(($) => `
      if (${$.hasBytes(3)}) {
        ${$.set(`${$.bufferAt(0)} | ${$.bufferAt(1, 8)} | ${$.bufferAt(2, 16)}`)}
        ${$.moveOffset(3)}
        ${$.continue()}
      } else if (${$.hasBytes(2)}) {
        temp = ${$.bufferAt(0)} | ${$.bufferAt(1, 8)};
        ${$.moveOffset(2)}
        ${$.escape('last')}
      } else if (${$.hasBytes()}) {
        temp = ${$.bufferAt(0)};
        ${$.moveOffset(1)}
        ${$.escape('next')}
      }
      ${$.escape()}
    `)

    .snippet('next', ($) => `
      if (${$.hasBytes(2)}) {
        ${$.set(`temp | ${$.bufferAt(0, 8)} | ${$.bufferAt(1, 16)}`)}
        ${$.moveOffset(2)}
        ${$.continue()}
      } else if (${$.hasBytes(1)}) {
        temp = temp | ${$.bufferAt(0, 8)};
        ${$.moveOffset(1)}
        ${$.escape('last')}
      }
      ${$.escape()}
    `)

    .snippet('last', ($) => `
      if (${$.hasBytes()}) {
        ${$.set(`temp | ${$.bufferAt(0, 16)}`)}
        ${$.moveOffset(1)}
        ${$.continue()}
      }
      ${$.escape()}
    `),
});

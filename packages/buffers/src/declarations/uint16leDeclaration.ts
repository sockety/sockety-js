import { createDeclaration } from '../createDeclaration';

export const uint16leDeclaration = createDeclaration({
  read: () => (operation) => operation
    .initialValue(0)
    .resetValue(false)
    .declare('temp', 0, false)

    .entry(($) => `
      if (${$.hasBytes(2)}) {
        ${$.set(`${$.bufferAt(0)} | ${$.bufferAt(1, 8)}`)}
        ${$.moveOffset(2)}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        temp = ${$.bufferAt(0)};
        ${$.moveOffset(1)}
        ${$.escape('next')}
      }
      ${$.escape()}
    `)

    .snippet('next', ($) => `
      if (${$.hasBytes()}) {
        ${$.set(`temp | ${$.bufferAt(0, 8)}`)}
        ${$.moveOffset(1)}
        ${$.continue()}
      }
      ${$.escape()}
    `),
});

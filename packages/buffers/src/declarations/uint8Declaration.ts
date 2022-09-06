import { createDeclaration } from '../createDeclaration';

export const uint8Declaration = createDeclaration({
  read: () => (operation) => operation
    .initialValue(0)
    .resetValue(true)
    .entry(($) => `
      if (${$.hasBytes()}) {
        ${$.set($.bufferAt(0))}
        ${$.moveOffset(1)}
        ${$.continue()}
      }
      ${$.escape()}
    `),
});

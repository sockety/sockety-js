import { createDeclaration } from '../createDeclaration';

export const passDynamicDeclaration = createDeclaration({
  read: (lengthKey: string) => (operation) => operation
    .initialValue('null')
    .resetValue(false)
    .declare('left', 0, true)

    .entry(($) => `
      ${$.local('left')} = Number(${$.read(lengthKey)});
      if (${$.local('left')} === 0) {
        ${$.continue()}
      }
      ${$.go('process')}
    `)
    // TODO: Do it without hacky access
    .snippet('process', ($) => `
      const left = ${$.local('left')};
      if (${$.hasBytes('left')}) {
        ${$.onlyWhenUsed(`_context._emit_${operation.name}(${$.buffer}, ${$.offset}, ${$.offset} + left)`)};
        ${$.moveOffset('left')}
        ${$.continue()}
      } else if (${$.hasBytes()}) {
        const end = isFinite(${$.end}) ? ${$.end} : ${$.buffer}.length;
        ${$.onlyWhenUsed(`_context._emit_${operation.name}(${$.buffer}, ${$.offset}, end)`)};
        const partLength = end - ${$.offset};
        ${$.local('left')} -= partLength;
        ${$.moveOffset('partLength')}
        ${$.escape()}
      } else {
        ${$.escape()}
      }
      
      // FIXME: This hack is used to tell BufferReader that this will emit/set something
      if (false) { ${$.set('')} }
    `),
});

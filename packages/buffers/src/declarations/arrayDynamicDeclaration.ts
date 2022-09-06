import { createDeclaration } from '../createDeclaration';
import { BufferReader } from '../BufferReader';

function getInitialCode(reader: BufferReader): string {
  return `{${
    Object.entries(reader.getVariables())
      .map(([ name, code ]) => `${name}: ${code}`)
      .join(', ')
  }}`;
}

export const arrayDynamicDeclaration = createDeclaration({
  read: (lengthKey: string, reader: BufferReader<any>) => (operation, prefix) => operation
    .initialValue('[]')
    .resetValue(true)

    .header(reader.build(prefix))
    .declare('item', getInitialCode(reader), false)
    .declare('ended', 'false', false)
    .declare('readItem', `${prefix}createReader({
      ${Object.keys(reader.getVariables()).map((key) => `${key}: (_$) => { item.${key} = _$ },`).join('\n      ')}
      _end: () => { ended = true },
    }).readOne`, false)
    .declare('resetItem', `() => {
      item = ${getInitialCode(reader)};
    }`, false)

    .declare('left', '0', false)
    .declare('temp', '[]')

    .entry(($) => `
      left = Number(${$.read(lengthKey)});
      if (left === 0) {
        ${$.set('[]')}
        ${$.continue()}
      }
      ${$.go('next')}
    `)
    .snippet('next', ($) => `
      do {
        ended = false;
        ${$.offset} = readItem(${$.buffer}, ${$.offset}, ${$.end});
        if (ended === false) {
          ${$.escape()}
        }
        left--;
        temp.push(item);
        resetItem();
      } while (left !== 0);
      
      ${$.set('temp')}
      ${$.continue()}
    `),
});

export const arrayDynamicContinuousDeclaration = createDeclaration({
  read: (lengthKey: string, reader: BufferReader<any>) => (operation, prefix) => operation
    .initialValue('[]')
    .resetValue(true)

    .header(reader.build(prefix))
    .declare('item', getInitialCode(reader), false)
    .declare('ended', 'false', false)
    .declare('readItem', `${prefix}createReader({
      ${Object.keys(reader.getVariables()).map((key) => `${key}: (_$) => { item.${key} = _$ },`).join('\n      ')}
      _end: () => { ended = true },
    }).readOne`, false)
    .declare('resetItem', `() => {
      item = ${getInitialCode(reader)};
    }`, false)

    .declare('left', '0', false)
    .declare('temp', '[]')

    .entry(($) => `
      left = Number(${$.read(lengthKey)});
      if (left === 0) {
        ${$.continue()}
      }
      ${$.go('next')}
    `)
    .snippet('next', ($) => `
      do {
        ended = false;
        ${$.offset} = readItem(${$.buffer}, ${$.offset}, ${$.end});
        if (ended === false) {
          ${$.escape()}
        }
        left--;
        ${$.onlyWhenUsed('temp.push(item);')}
        ${$.emit('item')}
        resetItem();
      } while (left !== 0);
      
      ${$.set('temp', false)}
      ${$.continue()}
    `),
});

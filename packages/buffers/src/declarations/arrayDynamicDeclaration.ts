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
    // TODO: Think about nicer way to use local properties?
    .declare('readItem', `${prefix}createReader({
      ${Object.keys(reader.getVariables()).map((key) => `${key}: (_$) => { this.$_${operation.name}_item.${key} = _$ },`).join('\n      ')}
      _end: () => { this.$_${operation.name}_ended = true },
    }).readOne`, false)
    // TODO: Think about nicer way to use local properties?
    .declare('resetItem', `() => {
      this.$_${operation.name}_item = ${getInitialCode(reader)};
    }`, false)

    .declare('left', '0', false)
    .declare('temp', '[]')

    .entry(($) => `
      ${$.local('left')} = Number(${$.read(lengthKey)});
      if (${$.local('left')} === 0) {
        ${$.set('[]')}
        ${$.continue()}
      }
      ${$.go('next')}
    `)
    .snippet('next', ($) => `
      do {
        ${$.local('ended')} = false;
        ${$.offset} = ${$.local('readItem')}(${$.buffer}, ${$.offset}, ${$.end});
        if (${$.local('ended')} === false) {
          ${$.escape()}
        }
        ${$.local('left')}--;
        ${$.local('temp')}.push(${$.local('item')});
        ${$.local('resetItem')}();
      } while (${$.local('left')} !== 0);
      
      ${$.set($.local('temp'))}
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
    // TODO: Think about nicer way to use local properties?
    .declare('readItem', `${prefix}createReader({
      ${Object.keys(reader.getVariables()).map((key) => `${key}: (_$) => { this.$_${operation.name}_item.${key} = _$ },`).join('\n      ')}
      _end: () => { this.$_${operation.name}_ended = true },
    }).readOne`, false)
    // TODO: Think about nicer way to use local properties?
    .declare('resetItem', `() => {
      this.$_${operation.name}_item = ${getInitialCode(reader)};
    }`, false)

    .declare('left', '0', false)
    .declare('temp', '[]')

    .entry(($) => `
      ${$.local('left')} = Number(${$.read(lengthKey)});
      if (${$.local('left')} === 0) {
        ${$.continue()}
      }
      ${$.go('next')}
    `)
    .snippet('next', ($) => `
      do {
        ${$.local('ended')} = false;
        ${$.offset} = ${$.local('readItem')}(${$.buffer}, ${$.offset}, ${$.end});
        if (${$.local('ended')} === false) {
          ${$.escape()}
        }
        ${$.local('left')}--;
        ${$.onlyWhenUsed(`${$.local('temp')}.push(${$.local('item')});`)}
        ${$.emit($.local('item'))}
        ${$.local('resetItem')}();
      } while (${$.local('left')} !== 0);
      
      ${$.set($.local('temp'), false)}
      ${$.continue()}
    `),
});

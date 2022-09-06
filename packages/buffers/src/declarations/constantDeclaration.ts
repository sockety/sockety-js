import { JsonValue } from 'type-fest';
import { createDeclaration } from '../createDeclaration';

export const constantDeclaration = createDeclaration({
  read: (value: JsonValue | undefined) => (operation) => operation
    .initialValue(value === undefined ? 'undefined' : JSON.stringify(value))
    .resetValue(false)
    .entry(($) => `
      ${$.set(value === undefined ? 'undefined' : JSON.stringify(value))}
      ${$.continue()}
    `),
});

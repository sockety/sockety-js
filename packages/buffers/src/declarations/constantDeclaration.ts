import { JsonValue } from 'type-fest';
import { createDeclaration } from '../createDeclaration';
import { convertValueToCode } from '../convertValueToCode';

export const constantDeclaration = createDeclaration({
  read: (value: JsonValue | undefined) => (operation) => operation
    .resetValue(false)
    .entry(($) => `
      ${$.set(convertValueToCode(value))}
      ${$.continue()}
    `),
});

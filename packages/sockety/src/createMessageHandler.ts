import { RawMessage } from '@sockety/core/src/read/RawMessage';

export function createMessageHandler<T extends Record<string, (message: RawMessage) => void>>(handlers: T): (message: RawMessage) => void {
  const keys = Object.keys(handlers);
  if (keys.length === 0) {
     return new Function('return (message) => message.revoke()') as any;
  }
  const codeDeclare = keys.map((key, index) => `const handler_${index} = handlers[${JSON.stringify(key)}];`).join('');
  const codeStrategy = keys.map((key, index) => `
    if (message.action === ${JSON.stringify(key)}) { return handler_${index}(message); }
  `.trim()).join('else ');
  const code = `${codeDeclare} return (message) => { ${codeStrategy} else { message.revoke() } }`;
  return new Function('handlers', code)(handlers) as any;
}

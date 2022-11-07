import { Message } from './Message';

export function createMessageHandler<T extends Record<string, (message: Message) => void>>(handlers: T): (message: Message) => void {
  const keys = Object.keys(handlers);
  if (keys.length === 0) {
     return new Function('return (message) => message.reject()') as any;
  }
  const codeDeclare = keys.map((key, index) => `const handler_${index} = handlers[${JSON.stringify(key)}];`).join('');
  const codeStrategy = keys.map((key, index) => `
    if (message.action === ${JSON.stringify(key)}) { return handler_${index}(message); }
  `.trim()).join('else ');
  const code = `${codeDeclare} return (message) => { ${codeStrategy} else { message.reject() } }`;
  return new Function('handlers', code)(handlers) as any;
}

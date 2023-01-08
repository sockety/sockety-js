import { FastReply } from '@sockety/core';
import { FunctionMimic } from './FunctionMimic';
import { Message } from './Message';
import { ActionHandler as ActionHandlerSymbol, ActionName as ActionNameSymbol } from './symbols';

type RawHandlerResult = void | FastReply | number;
type HandlerResult = RawHandlerResult | Promise<RawHandlerResult>;

type InputHandler = (message: Message) => Promise<void>;
type ActionHandler = (message: Message) => HandlerResult;
type Handler = (message: Message, error: Error | null) => HandlerResult;
type ErrorHandler = (message: Message, error: Error) => HandlerResult;

type RawActionHandler = Handler & { [ActionNameSymbol]: string, [ActionHandlerSymbol]: ActionHandler };

// eslint-disable-next-line max-len, consistent-return
const createActionHandler = (name: string, handler: ActionHandler): RawActionHandler => Object.assign((message: Message, error: Error | null) => {
  if (message.action === name && error === null) {
    return handler(message);
  }
}, {
  [ActionNameSymbol]: name,
  [ActionHandlerSymbol]: handler,
});

function isRawActionHandler(handler: unknown): handler is RawActionHandler {
  return typeof handler === 'function' && ActionNameSymbol in handler;
}

export class MessageHandler extends FunctionMimic<InputHandler> {
  #handlers: (Handler | RawActionHandler)[] = [];
  #cached?: InputHandler;

  #revokeCache(): void {
    this.#cached = undefined;
  }

  #optimize(): InputHandler {
    const handlers = this.#handlers.slice();

    // Optimize action handlers
    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i];

      if (!isRawActionHandler(handler)) {
        break;
      }

      // Combine multiple consecutive action handlers to switch instruction
      const actions = {
        [handler[ActionNameSymbol]]: handler[ActionHandlerSymbol],
      };

      // Search until there is common handler, or there is already such action
      let j = i + 1;
      for (; j < handlers.length; j++) {
        const handler2 = handlers[j];

        if (!isRawActionHandler(handler2) || actions[handler2[ActionNameSymbol]]) {
          break;
        }

        actions[handler2[ActionNameSymbol]] = handler2[ActionHandlerSymbol];
      }

      // There was single action, so ignore optimization
      if (j - i === 1) {
        // eslint-disable-next-line no-continue
        continue;
      }

      // Combine multiple actions
      const names = Object.keys(actions);
      const combined = new Function(...names.map((_, idx) => `action_${idx}`), `
        return (message, error) => {
          if (error === null) {
            switch (message.action) {
              ${names.map((name, idx) => `case ${JSON.stringify(name)}: return action_${idx}(message);`).join('\n')}
            }
          }
        }
      `)(...names.map((key) => actions[key]));

      // Replace multiple handlers with a single one
      handlers.splice(i, j - i, combined);
    }

    // Build handler looping over all handlers
    const count = handlers.length;
    return async (message: Message) => {
      let error: Error | null = null;
      const expects = message.expectsResponse;
      for (let i = 0; i < count; i++) {
        try {
          const direct = handlers[i](message, error);
          // eslint-disable-next-line no-await-in-loop
          const result = direct instanceof Promise ? await direct : direct;
          if (expects && typeof result === 'number' && !message.responded) {
            // eslint-disable-next-line no-await-in-loop
            await message.fastReply(result);
          }
        } catch (e: any) {
          error = e;
        }
      }
    };
  }

  public use(handler: Handler): this {
    this.#revokeCache();
    this.#handlers.push(handler);
    return this;
  }

  public action(name: string, handler: ActionHandler): this {
    this.#revokeCache();
    this.#handlers.push(createActionHandler(name, handler));
    return this;
  }

  public error(handler: ErrorHandler): this {
    this.#revokeCache();
    // eslint-disable-next-line consistent-return
    this.#handlers.push((message, error) => {
      if (error != null) {
        return handler(message, error);
      }
    });
    return this;
  }

  // TODO: Auto-optimize sub-handlers?
  public optimize(): InputHandler {
    if (!this.#cached) {
      this.#cached = this.#optimize();
    }
    return this.#cached;
  }

  public mimic(message: Message): Promise<void> {
    return this.optimize()(message);
  }
}

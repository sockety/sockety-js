import { Message } from './Message';
import { FastReply } from '@sockety/core/src/constants';
import { FunctionMimic } from './FunctionMimic';

type RawHandlerResult = void | FastReply | number;
type HandlerResult = RawHandlerResult | Promise<RawHandlerResult>;
type BasicHandler = (message: Message) => HandlerResult;
type ErrorHandler = (message: Message, error: Error) => HandlerResult;
type AfterHandler = (message: Message, error: Error | null) => void;

const noop = () => {};

interface MessageHandlerOptions {
  // TODO: Think how it should work in case of lack of response
  // autoAck: boolean;
}

export class MessageHandler extends FunctionMimic<(message: Message) => Promise<void>> {
  readonly #options: MessageHandlerOptions;

  readonly #before: BasicHandler[] = [];
  readonly #run: BasicHandler[] = [];
  readonly #error: ErrorHandler[] = [];
  readonly #after: AfterHandler[] = [];

  public constructor(options: Partial<MessageHandlerOptions> = {}) {
    // Mimic function
    super();

    // Apply options
    this.#options = {
      // autoAck: Boolean(options.autoAck),
    };
  }

  public on(action: string, handler: BasicHandler): this {
    return this.any((message) => {
      if (message.action === action) {
        return handler(message);
      }
    });
  }

  public any(handler: BasicHandler): this {
    this.#run.push(handler);
    return this;
  }

  public after(handler: AfterHandler): this {
    this.#after.push(handler);
    return this;
  }

  public before(handler: BasicHandler): this {
    this.#before.push(handler);
    return this;
  }

  public error(handler: ErrorHandler): this {
    this.#error.push(handler);
    return this;
  }

  async #callError(message: Message, error: Error): Promise<void> {
    // Run all error handlers until the message will have response
    for (const errorHandler of this.#error) {
      await Promise.resolve(errorHandler(message, error)).catch(noop);
      if (message.responded) {
        break;
      }
    }
  }

  async #callAfter(message: Message, error: Error | null = null): Promise<void> {
    // Run all "after" handlers
    for (const afterHandler of this.#after) {
      await Promise.resolve(afterHandler(message, error)).catch(noop);
    }

    // If there was no response despite error, throw InternalError
    if (error != null && !message.responded) {
      await message.fastReply(FastReply.InternalError);
    }
  }

  // TODO: Make it nicer
  protected async __call__(message: Message): Promise<void> {
    // Run "before/run" handlers, until it will return some response
    for (const handler of this.#before.concat(this.#run)) {
      try {
        // Call the handler
        const result = await handler(message);

        // Return the result if it may be fast reply
        if (typeof result === 'number') {
          await message.fastReply(result);
        }

        // End, when there was already response
        if (message.responded) {
          await this.#callAfter(message);
          return;
        }
      } catch (error: any) {
        await this.#callError(message, error);
        await this.#callAfter(message, error);
      }
    }
  }

  public optimize(): (message: Message) => Promise<void> {
    // TODO: Prepare optimization
    // TODO: Consider auto-optimization of sub handlers
    return this.__call__.bind(this);
  }

  public static create(options: Partial<MessageHandlerOptions> = {}): MessageHandler {
    return new MessageHandler(options);
  }
}

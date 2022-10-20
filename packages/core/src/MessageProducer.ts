import { SocketWriter } from './SocketWriter';

declare const MessageProducerSymbol: unique symbol;

export type MessageProducerCallback<T> = (error: Error | null | undefined, message?: T) => void;
export type RawMessageProducer<T> = (writer: SocketWriter, expectsResponse: boolean, callback: MessageProducerCallback<T>) => void;
export type MessageProducer<T = any> = RawMessageProducer<T> & { [MessageProducerSymbol]: true };

export function createMessageProducer<T>(fn: RawMessageProducer<T>): MessageProducer<T> {
  return fn as MessageProducer<T>;
}

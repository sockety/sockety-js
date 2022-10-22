import { SocketWriter } from './SocketWriter';

declare const ContentProducerSymbol: unique symbol;

export type ContentProducerCallback<T> = (error: Error | null | undefined, message?: T) => void;
export type RawContentProducer<T> = (writer: SocketWriter, expectsResponse: boolean, callback: ContentProducerCallback<T>) => void;
export type ContentProducer<T = any> = RawContentProducer<T> & { [ContentProducerSymbol]: true };

export function createContentProducer<T>(fn: RawContentProducer<T>): ContentProducer<T> {
  return fn as ContentProducer<T>;
}

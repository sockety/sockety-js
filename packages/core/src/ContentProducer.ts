import { StreamWriter } from './StreamWriter';

declare const ContentProducerSymbol: unique symbol;

export type SendCallback = (error: Error | null | undefined) => void;
export type WriteCallback = () => void;
export type RawContentProducer<T> = (writer: StreamWriter, sent: SendCallback, written: WriteCallback, expectsResponse: boolean) => T;
export type ContentProducer<T = any> = RawContentProducer<T> & { [ContentProducerSymbol]: true };

export function createContentProducer<T>(fn: RawContentProducer<T>): ContentProducer<T> {
  return fn as ContentProducer<T>;
}

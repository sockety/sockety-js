import { StreamWriter } from './StreamWriter';

// TODO: Try to unify ContentProducer and ContentProducerSlice

export type RegisterCallback = () => void;
export type SendCallback = (error: Error | null | undefined) => void;

declare const ContentProducerSymbol: unique symbol;
export type RawContentProducer<T> = (writer: StreamWriter, sent: SendCallback, registered: RegisterCallback, expectsResponse: boolean) => T;
export type ContentProducer<T = any> = RawContentProducer<T> & { [ContentProducerSymbol]: true };

export function createContentProducer<T>(fn: RawContentProducer<T>): ContentProducer<T> {
  return fn as ContentProducer<T>;
}

declare const ContentProducerSliceSymbol: unique symbol;
export type RawContentProducerSlice = (writer: StreamWriter, sent: SendCallback, registered: RegisterCallback, channel: number) => void;
export type ContentProducerSlice = RawContentProducerSlice & { [ContentProducerSliceSymbol]: true };

export function createContentProducerSlice<T>(fn: RawContentProducerSlice): ContentProducerSlice {
  return fn as ContentProducerSlice;
}

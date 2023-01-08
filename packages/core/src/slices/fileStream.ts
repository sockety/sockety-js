import { Readable } from 'node:stream';
import { createContentProducerSlice } from '../ContentProducer';
import { noop } from '../noop';
import { fileContent } from './fileContent';
import { fileEnd } from './fileEnd';

// TODO: Abort when it's aborted/closed
export function fileStream(index: number, stream: Readable) {
  const contentSlice = fileContent(index);
  return createContentProducerSlice((writer, sent, registered, channel) => {
    stream.on('data', (data) => contentSlice(data)(writer, noop, noop, channel));
    stream.once('end', () => fileEnd(index)(writer, sent, registered, channel));
  });
}

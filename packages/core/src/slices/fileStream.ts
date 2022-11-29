import { createContentProducerSlice } from '../ContentProducer';
import { Readable } from 'node:stream';
import { fileContent } from './fileContent';
import { fileEnd } from './fileEnd';

// TODO: Abort when it's aborted/closed
export const fileStream = (index: number, stream: Readable) => {
  const contentSlice = fileContent(index);
  return createContentProducerSlice((writer, channel, sent, registered) => {
    stream.on('data', (data) => contentSlice(data)(writer, channel));
    stream.once('end', () => fileEnd(index)(writer, channel, sent, registered));
  });
}

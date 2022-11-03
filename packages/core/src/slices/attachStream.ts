import { createContentProducerSlice } from '../ContentProducer';
import { ATTACH_STREAM, RequestStream } from '../RequestStream';
import { none } from './none';

// TODO: Abort when it's aborted/closed
export const attachStream = (stream?: RequestStream | null) => {
  if (stream == null) {
    return none;
  }
  return createContentProducerSlice((writer, channel, sent, written, registered) => {
    stream[ATTACH_STREAM](channel, sent, written);
    registered?.();
  });
}

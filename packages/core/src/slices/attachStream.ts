import { createContentProducerSlice } from '../ContentProducer';
import { RequestStream } from '../RequestStream';
import { none } from './none';
import { AttachStream } from '../symbols';

// TODO: Abort when it's aborted/closed
export const attachStream = (stream?: RequestStream | null) => {
  if (stream == null) {
    return none;
  }
  return createContentProducerSlice((writer, sent, registered, channel) => {
    stream[AttachStream](channel, sent, registered);
  });
}

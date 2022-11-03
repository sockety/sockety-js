import { createContentProducerSlice } from '../ContentProducer';
import { ATTACH_STREAM, RequestStream } from '../RequestStream';
import { none } from './none';

// TODO: Abort when it's aborted/closed
export const endStream = createContentProducerSlice((writer, channel, sent, written, registered) => {
  writer.channelNoCallback(channel);
  writer.endStream(sent, written);
  registered?.();
});

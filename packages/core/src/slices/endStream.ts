import { createContentProducerSlice } from '../ContentProducer';

// TODO: Abort when it's aborted/closed
export const endStream = createContentProducerSlice((writer, channel, sent, registered) => {
  writer.channel(channel);
  writer.endStream(sent);
  registered();
});

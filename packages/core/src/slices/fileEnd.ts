import { createContentProducerSlice } from '../ContentProducer';

export function fileEnd(index: number) {
  return createContentProducerSlice((writer, sent, registered, channel) => {
    writer.channel(channel);
    writer.endFile(index, sent);
    registered();
  });
}

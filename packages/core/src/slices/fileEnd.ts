import { createContentProducerSlice } from '../ContentProducer';

export const fileEnd = (index: number) => createContentProducerSlice((writer, channel, sent, registered) => {
  writer.channel(channel);
  writer.endFile(index, sent);
  registered?.();
})

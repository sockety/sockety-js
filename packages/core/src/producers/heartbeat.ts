import { createContentProducer } from '../ContentProducer';

export const heartbeat = createContentProducer<void>((writer, sent, written) => {
  writer.heartbeat(sent, written);
});

import { createContentProducer } from '../ContentProducer';

export const heartbeat = createContentProducer<void>((writer, sent, registered) => {
  writer.heartbeat(sent);
  registered();
});

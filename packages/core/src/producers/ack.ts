import { UUID } from '@sockety/uuid';
import { createContentProducer, ContentProducer } from '../ContentProducer';

export function ack(uuid: UUID): ContentProducer<void> {
  return createContentProducer<void>((writer, sent, written) => {
    writer.ack(uuid, sent, written);
  });
}

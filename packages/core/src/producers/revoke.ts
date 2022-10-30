import { UUID } from '@sockety/uuid';
import { createContentProducer, ContentProducer } from '../ContentProducer';

export function revoke(uuid: UUID): ContentProducer<void> {
  return createContentProducer<void>((writer, sent, written) => {
    writer.revoke(uuid, sent, written);
  });
}

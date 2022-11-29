import { UUID } from '@sockety/uuid';
import { createContentProducer, ContentProducer } from '../ContentProducer';
import { FastReply } from '../constants';

export function fastReply(uuid: UUID, code: FastReply | number): ContentProducer<void> {
  return createContentProducer<void>((writer, sent, registered) => {
    writer.fastReply(uuid, code, sent);
    registered();
  });
}

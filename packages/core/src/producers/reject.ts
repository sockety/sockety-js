import { UUID } from '@sockety/uuid';
import { createContentProducer, ContentProducer } from '../ContentProducer';
import { FastReply } from '../constants';

export function reject(uuid: UUID): ContentProducer<void> {
  return createContentProducer<void>((writer, sent, written) => {
    writer.fastReply(uuid, FastReply.Reject, sent, written);
  });
}

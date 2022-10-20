import { UUID } from '@sockety/uuid';
import { OutgoingMessageStream } from './OutgoingMessageStream';

type Callback = (error: Error | null | undefined) => void;

export class OutgoingMessage<Stream = true | false> {
  public readonly id: UUID;
  public readonly stream: Stream extends true ? OutgoingMessageStream : null;

  public constructor(id: UUID, stream: Stream extends true ? OutgoingMessageStream : null) {
    this.id = id;
    this.stream = stream;
  }

  // TODO: Add "Started" property when it will be created before sending
  // TODO: Add helper to abort
  // TODO: Add handlers to watch for load
  // TODO: Not here: Add handlers to generate ACK/REVOKE?
  // TODO: Add helpers to watch for ack/revoke?
}

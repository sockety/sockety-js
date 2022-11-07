import { RawMessage } from '@sockety/core/src/read/RawMessage';
import { UUID } from '@sockety/uuid';
import { Connection } from './Connection';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { Request } from './Request';
import { createResponse } from '@sockety/core/src/createResponse';
import { accept } from '@sockety/core/src/producers/accept';
import { reject } from '@sockety/core/src/producers/reject';

// TODO: Extract type
type FileBufferSent = { name: string, buffer: Buffer };
type FileStreamSent = { name: string, size: number, stream: Readable };
type FileSent = FileBufferSent | FileStreamSent;

interface RespondOptions {
  data?: Buffer;
  files?: FileSent[];
}

export class Message extends RawMessage {
  readonly #connection: Connection;

  public constructor(
    connection: Connection,
    id: UUID,
    action: string,
    dataSize: number,
    filesCount: number,
    totalFilesSize: number,
    hasStream: boolean,
    expectsResponse: boolean,
  ) {
    super(id, action, dataSize, filesCount, totalFilesSize, hasStream, expectsResponse);
    this.#connection = connection;
  }

  public respond<T extends true | false | undefined>(options: RespondOptions, hasStream?: T): T extends undefined ? Promise<Request<false>> : Promise<Request<T>> {
    return this.#connection.send(createResponse(options, Boolean(hasStream))(this.id)) as any;
  }

  // TODO: Support other fast replies too
  public accept(): Promise<void> {
    return this.#connection.pass(accept(this.id));
  }

  // TODO: Support other fast replies too
  public reject(): Promise<void> {
    return this.#connection.pass(reject(this.id));
  }
}

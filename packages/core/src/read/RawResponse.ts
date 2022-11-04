import { UUID } from '@sockety/uuid';
import { MessageBase } from './MessageBase';

export class RawResponse extends MessageBase {
  readonly #parentId: UUID;

  public constructor(
    id: UUID,
    parentId: UUID,
    dataSize: number,
    filesCount: number,
    totalFilesSize: number,
    hasStream: boolean,
    expectsResponse: boolean,
  ) {
    super(id, dataSize, filesCount, totalFilesSize, hasStream, expectsResponse);
    this.#parentId = parentId;
  }

  public get parentId(): UUID {
    return this.#parentId;
  }
}

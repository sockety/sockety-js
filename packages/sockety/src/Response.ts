import { RawResponse } from '@sockety/core/src/read/RawResponse';
import { UUID } from '@sockety/uuid';
import { Connection } from './Connection';

export class Response extends RawResponse {
  readonly #connection: Connection;

  public constructor(
    connection: Connection,
    id: UUID,
    parentId: UUID,
    dataSize: number,
    filesCount: number,
    totalFilesSize: number,
    hasStream: boolean,
    expectsResponse: boolean,
  ) {
    super(id, parentId, dataSize, filesCount, totalFilesSize, hasStream, expectsResponse);
    this.#connection = connection;
  }
}

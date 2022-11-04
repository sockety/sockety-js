import { UUID } from '@sockety/uuid';
import { MessageBase } from './MessageBase';

export class Message extends MessageBase {
  readonly #action: string;

  public constructor(
    id: UUID,
    action: string,
    dataSize: number,
    filesCount: number,
    totalFilesSize: number,
    hasStream: boolean,
    expectsResponse: boolean,
  ) {
    super(id, dataSize, filesCount, totalFilesSize, hasStream, expectsResponse);
    this.#action = action;
  }

  public get action(): string {
    return this.#action;
  }
}

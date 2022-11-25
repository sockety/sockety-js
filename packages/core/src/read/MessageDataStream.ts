import { MessageStream } from './MessageStream';
import { Ended, Close } from '../symbols';

export class MessageDataStream extends MessageStream {
  public readonly size: number;

  public constructor(size: number) {
    super();
    this.size = size;
  }

  public get bytesLeft(): number {
    return Math.max(this.size - this.receivedSize, 0);
  }

  public get loaded(): boolean {
    return this[Ended];
  }

  public [Close](): void {
    if (!this.loaded) {
      this.emit('error', new Error('Message has been closed before data loaded'));
    }
  }
}

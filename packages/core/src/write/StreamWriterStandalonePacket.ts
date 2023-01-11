import { SendCallback } from '../ContentProducer';
import { noop } from '../noop';
import { WritableBuffer } from './WritableBuffer';
import { StreamWriterInstruction } from './StreamWriterInstruction';

type Instruction = ($: WritableBuffer) => void;

export class StreamWriterStandalonePacket implements StreamWriterInstruction {
  public readonly bytes = 0;
  public bufferedBytes;
  #instruction: Instruction = noop;
  public next: StreamWriterInstruction | undefined;

  public constructor(instruction: Instruction, bytes: number, sent: SendCallback = noop) {
    this.bufferedBytes = bytes;
    this.#instruction = sent === noop ? instruction : ($) => {
      instruction($);
      $.addCallback(sent);
    };
  }

  public pass(next: StreamWriterInstruction): void {
    this.next = next;
  }

  public callback(sent: SendCallback = noop): void {
    if (sent !== noop) {
      const prev = this.#instruction;
      this.#instruction = ($) => {
        prev($);
        $.addCallback(sent);
      };
    }
  }

  public run(buffer: WritableBuffer): void {
    this.#instruction(buffer);
  }
}

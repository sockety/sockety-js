import { WritableBuffer } from './WritableBuffer';
import { SendCallback } from './ContentProducer';

type Instruction = ($: WritableBuffer) => void;

export interface StreamWriterInstruction {
  bufferedBytes: number;
  bytes: number;
  next: StreamWriterInstruction | undefined;
  callback(sent: SendCallback): void;
  pass(next: StreamWriterInstruction): void;
  run(buffer: WritableBuffer): void;
}

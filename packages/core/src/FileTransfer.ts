import { Buffer } from 'node:buffer';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { ContentProducerSlice } from './ContentProducer';
import { fileStream } from './slices/fileStream';
import { pipe } from './slices/pipe';
import { fileContent } from './slices/fileContent';
import { fileEnd } from './slices/fileEnd';
import { CreateProducerSlice } from './symbols';

export class FileTransfer {
  readonly #slice: (index: number) => ContentProducerSlice;
  readonly #readOnlyOnce: boolean;
  public readonly size: number;
  public readonly name: string;
  #readable = true;

  private constructor(slice: (idx: number) => ContentProducerSlice, readOnlyOnce: boolean, size: number, name: string) {
    this.#slice = slice;
    this.#readOnlyOnce = readOnlyOnce;
    this.size = size;
    this.name = name;
  }

  public [CreateProducerSlice](index: number): ContentProducerSlice {
    if (!this.#readable) {
      throw new Error('FileTransfer with stream may be used only once.');
    } else if (this.#readOnlyOnce) {
      this.#readable = false;
    }
    return this.#slice(index);
  }

  public static stream(stream: Readable, size: number, name: string): FileTransfer {
    return new FileTransfer((index) => fileStream(index, stream), true, size, name);
  }

  public static buffer(data: Buffer, name: string): FileTransfer {
    return new FileTransfer((index) => pipe([ fileContent(index)(data), fileEnd(index) ]), false, data.length, name);
  }

  public static fs(filePath: string, name = basename(filePath)): Promise<FileTransfer> {
    return stat(filePath).then(({ size }) => new FileTransfer(
      (index) => fileStream(index, createReadStream(filePath)),
      false,
      size,
      name,
    ));
  }
}

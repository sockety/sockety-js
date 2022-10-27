import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';
import { createContentProducer, ContentProducer } from './ContentProducer';
import { Request } from './Request';
import {
  MessageActionSizeBits,
  MessageDataSizeBits,
  MessageFilesCountBits,
  MessageFilesSizeBits,
} from './constants';
import { generateUuid } from '@sockety/uuid';
import { RequestStream } from './RequestStream';

export type File = any;
export type MessagePackSerializable = any;

export interface DraftMessageData {
  hasCustomFiles: boolean;
  hasCustomPayload: boolean;
  hasCustomMessagePackPayload: boolean;
  hasStream: boolean;
}

export interface DraftMessageDataDefaults {
  hasCustomFiles: false;
  hasCustomPayload: false;
  hasCustomMessagePackPayload: false;
  hasStream: false;
}

export type DraftTemplateData<T extends DraftMessageData> =
  (T['hasCustomFiles'] extends false ? {} : { files: File[] }) &
  (T['hasCustomPayload'] extends false
    ? {}
    : T['hasCustomMessagePackPayload'] extends false ? { data: Buffer } : { data: MessagePackSerializable });

const NONE = Buffer.allocUnsafeSlow(0);

export class DraftMessage<T extends DraftMessageData = DraftMessageDataDefaults> {
  readonly #action: string;
  #hasFiles: boolean = false;
  #hasStream: boolean = false;
  #dataBuffer: Buffer = NONE;
  #files: File[] = [];

  public constructor(action: string) {
    this.#action = action;
  }

  public allowData(): DraftMessage<Omit<T, 'hasCustomPayload'> & { hasCustomPayload: true }> {
    return this as any;
  }

  public rawData(buffer: Buffer): DraftMessage<Omit<T, 'hasCustomPayload'> & { hasCustomPayload: false }> {
    this.#dataBuffer = buffer;
    return this as any;
  }

  public data(data: MessagePackSerializable): DraftMessage<Omit<T, 'hasCustomPayload'> & { hasCustomPayload: false }> {
    return this.rawData(data);
  }

  public withStream(hasStream: boolean = true): DraftMessage<Omit<T, 'hasStream'> & { hasStream: true }> {
    this.#hasStream = hasStream;
    return this as any;
  }

  public file(name: string, data: Buffer | string | Readable): this {
    this.#files.push({ name, data });
    // // @ts-ignore: TODO: Size for readable?
    // this.#files.push({ name, data, size: data.length });
    return this;
  }

  public fileFromDisk(filePath: string): this;
  public fileFromDisk(name: string, filePath: string): this;
  public fileFromDisk(nameOrFilePath: string, filePath?: string): this {
    // TODO: file size?
    if (typeof filePath === 'string') {
      return this.file(nameOrFilePath, createReadStream(filePath));
    }
    return this.file(basename(nameOrFilePath), createReadStream(nameOrFilePath));
  }

  public prepare(): keyof DraftTemplateData<T> extends never
    ? (params?: {}) => ContentProducer<Request>
    : T['hasStream'] extends true
      ? (params: DraftTemplateData<T>) => ContentProducer<Request>
      : (params: DraftTemplateData<T>) => ContentProducer<Request<true>> {
    const operations = [];
    const hasStream = this.#hasStream;
    const action = Buffer.from([ 4, 112, 105, 110, 103 ]);
    const actionLength = 5;

    return ((params: any) => {
      return createContentProducer((writer, expectsResponse, callback) => {
        writer.reserveChannel((channelId, release) => {
          // const id = generateUuid();
          // console.log(`Buffer.from([`, buffer.join(', '), '])');
          // ToDO: Wait for drain
          const id = generateUuid();
          writer.notifyLength(21 + actionLength); // Optimization
          writer.ensureChannel(channelId);
          writer.writeMessageSignature(1 + actionLength + 16, hasStream, expectsResponse);
          writer.writeUint8(MessageFilesCountBits.None | MessageFilesSizeBits.Uint16 | MessageDataSizeBits.None | MessageActionSizeBits.Uint8);
          writer.writeUuid(id);

          if (hasStream) {
            if (expectsResponse) {
              writer.write(action, (error) => {
                if (error != null) {
                  callback(error);
                  release();
                } else {
                  const stream = new RequestStream(channelId, writer, release);
                  const message = new Request<true>(id, stream);
                  callback(null, message);
                }
              })
            } else {
              writer.write(action);
              writer.writeStreamEnd(channelId, callback);
              release();
            }
          } else {
            writer.write(action, (error) => {
              if (error) {
                callback(error);
              } else if (expectsResponse) {
                const message = new Request<false>(id, null);
                callback(null, message);
              } else {
                callback(null);
              }
            });
            release();
          }
        });
      });
    }) as any;
  }

  public static for(action: string): DraftMessage {
    return new DraftMessage(action);
  }
}

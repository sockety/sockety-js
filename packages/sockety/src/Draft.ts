import { Buffer } from 'node:buffer';
import * as msgpack from 'msgpackr';
import { ContentProducer, ContentProducerSlice, createContentProducer } from '@sockety/core/src/ContentProducer';
import { Request as RawRequest, REQUEST_DONE } from '@sockety/core/src/Request';
import { action } from '@sockety/core/src/slices/action';
import { none } from '@sockety/core/src/slices/none';
import { data } from '@sockety/core/src/slices/data';
import { messageStart } from '@sockety/core/src/slices/messageStart';
import { generateUuid } from '@sockety/uuid';
import { RequestStream } from '@sockety/core/src/RequestStream';
import { pipe } from '@sockety/core/src/slices/pipe';
import { dataSize } from '@sockety/core/src/slices/dataSize';
import { endStream } from '@sockety/core/src/slices/endStream';
import { parallel } from '@sockety/core/src/slices/parallel';
import { attachStream } from '@sockety/core/src/slices/attachStream';
import { filesListHeader } from '@sockety/core/src/slices/filesListHeader';
import { filesList } from '@sockety/core/src/slices/filesList';
import { CREATE_PRODUCER_SLICE, FileTransfer } from '@sockety/core/src/FileTransfer';
import { FunctionMimic } from './FunctionMimic';

enum DraftDataType {
  none = 0,
  raw = 1,
  msgpack = 2,
}

export interface DraftConfig {
  stream: boolean;
  files: boolean;
  data: DraftDataType;
  dataType: any;
}

export interface DraftConfigDefaults {
  stream: false;
  files: false;
  data: DraftDataType.none;
  dataType: any;
}

type UseStream<T extends DraftConfig, U extends boolean> = Omit<T, 'stream'> & { stream: U };
type UseData<T extends DraftConfig, U extends DraftDataType, V = any> = Omit<T, 'data' | 'dataType'> & { data: U, dataType: V };
type UseFiles<T extends DraftConfig, U extends boolean> = Omit<T, 'files'> & { files: U };

type Input<T extends DraftConfig> =
  (T['data'] extends DraftDataType.msgpack
    ? { data: T['dataType'] }
    : T['data'] extends DraftDataType.raw ? { data: Buffer } : {}) &
  (T['files'] extends true ? { files: FileTransfer[] } : {});

type ProducerFactory<T extends DraftConfig> = [keyof Input<T>] extends [never]
  ? (input?: Input<T>) => ContentProducer<RawRequest<T['stream']>>
  : (input: Input<T>) => ContentProducer<RawRequest<T['stream']>>;

function createRawDataOperation(content: Buffer | string): [ ContentProducerSlice, ContentProducerSlice, number ] {
  const length = content.length;
  return [ data(content), dataSize(length), length ];
}

function createMessagePackDataOperation(content: any): [ ContentProducerSlice, ContentProducerSlice, number ] {
  return createRawDataOperation(msgpack.encode(content));
}

function createFilesOperation(files: FileTransfer[]): [ ContentProducerSlice, ContentProducerSlice, number, number ] {
  // Build slices for files transfer
  const filesSlice = parallel(files.map((file, index) => file[CREATE_PRODUCER_SLICE](index)));

  // Compute files details
  const filesCount = files?.length || 0;
  // @ts-ignore: avoid checks for better performance
  const totalFilesSize = files?.reduce((acc, file) => acc + (file.size ?? file.buffer.length), 0) || 0;

  // Build header
  const filesSpecSlice = filesListHeader(filesCount, totalFilesSize);
  const filesHeaderSlice = filesList(files);

  return [ filesSlice, pipe([ filesSpecSlice, filesHeaderSlice ]), filesCount, totalFilesSize ];
}

export class Draft<T extends DraftConfig = DraftConfigDefaults> extends FunctionMimic<ProducerFactory<T>> {
  #stream: boolean = false;
  #allowFiles: boolean = false;
  #allowData: DraftDataType = DraftDataType.none;

  // Keep pre-prepared operations
  readonly #action: ContentProducerSlice;
  readonly #actionLength: number;
  // TODO: Think if such tuple is fine
  #files: (files: FileTransfer[]) => [ ContentProducerSlice, ContentProducerSlice, number, number ] = () => [ none, none, 0, 0 ];
  // TODO: Think if such tuple is fine
  #data: (data: Buffer) => [ ContentProducerSlice, ContentProducerSlice, number ] = () => [ none, none, 0 ];

  // Keep cached optimized draft
  #cached?: ProducerFactory<T>;

  public constructor(name: string) {
    super();
    this.#action = action(name);
    this.#actionLength = Buffer.byteLength(name);
  }

  #revokeCache(): void {
    this.#cached = undefined;
  }

  public stream(): Draft<UseStream<T, true>> {
    this.#revokeCache();
    this.#stream = true;
    return this as any;
  }

  public files(): Draft<UseFiles<T, true>>;
  public files(files: FileTransfer[]): Draft<UseFiles<T, false>>;
  public files(files?: FileTransfer[]): Draft<UseFiles<T, boolean>> {
    this.#revokeCache();
    if (files === undefined) {
      this.#allowFiles = true;
      this.#files = createFilesOperation;
    } else {
      this.#allowFiles = false;
      const cachedData = createFilesOperation(files);
      this.#files = () => cachedData;
    }
    return this as any;
  }

  public data(): Draft<UseData<T, DraftDataType.raw>>;
  public data(content: Buffer | string): Draft<UseData<T, DraftDataType.none>>;
  public data(content?: Buffer | string): Draft<UseData<T, DraftDataType.raw | DraftDataType.none>> {
    this.#revokeCache();
    if (content === undefined) {
      this.#allowData = DraftDataType.raw;
      this.#data = createRawDataOperation;
    } else {
      this.#allowData = DraftDataType.none;
      const cachedData = createRawDataOperation(content);
      this.#data = () => cachedData;
    }
    return this as any;
  }

  public msgpack<U>(): Draft<UseData<T, DraftDataType.msgpack, U>>;
  public msgpack<U>(content: U): Draft<UseData<T, DraftDataType.none>>;
  public msgpack<U>(content?: U): Draft<UseData<T, DraftDataType.msgpack | DraftDataType.none, U>> {
    this.#revokeCache();
    if (content === undefined) {
      this.#allowData = DraftDataType.msgpack;
      this.#data = createMessagePackDataOperation;
    } else {
      this.#allowData = DraftDataType.none;
      const cachedData = createMessagePackDataOperation(content);
      this.#data = () => cachedData;
    }
    return this as any;
  }

  #optimize(): ProducerFactory<T> {
    // Extract already known information
    const hasStream = this.#stream;
    const actionSlice = this.#action;
    const actionLength = this.#actionLength;

    // Extract builders for other operations
    const createDataSlices = this.#data;
    const createFilesSlices = this.#files;
    const createMessageStartSliceFactory = messageStart(hasStream, actionLength);

    return ((input?: Input<T>) => {
      // Extract input
      // @ts-ignore: simpler for better performance
      const inputData = input?.data;
      // @ts-ignore: simpler for better performance
      const inputFiles = input?.files;

      // Validate
      if (this.#allowFiles && !inputFiles) {
        throw new Error('The message requires "files" property.');
      } else if (this.#allowData && inputData === undefined) {
        throw new Error('The message requires "data" property.');
      }

      // Prepare slices
      const [ dataSlice, dataSizeSlice, dataSize ] = createDataSlices(inputData);
      const [ filesSlice, filesHeaderSlice, filesCount, totalFilesSize ] = createFilesSlices(inputFiles);
      const createMessageStartSlice = createMessageStartSliceFactory(dataSize, filesCount, totalFilesSize);

      return createContentProducer((writer, sent, written, expectsResponse) => {
        const id = generateUuid();
        const stream = hasStream && expectsResponse ? new RequestStream(writer) : null;
        const request = new RawRequest(id, stream);

        writer.reserveChannel((channel, release) => {
          pipe([
            createMessageStartSlice(id, expectsResponse),
            actionSlice,
            dataSizeSlice,
            filesHeaderSlice,
            hasStream && !stream ? endStream : none,
            parallel([
              dataSlice,
              attachStream(stream),
              filesSlice,
            ]),
          ])(writer, channel, (error: Error | null | undefined) => {
            sent(error);
            request[REQUEST_DONE](error);
          }, written, release);
        });

        return request;
      });
    }) as any;
  }

  public optimize(): ProducerFactory<T> {
    if (!this.#cached) {
      this.#cached = this.#optimize();
    }
    return this.#cached;
  }

  public __call__(input?: Input<T>): ReturnType<ProducerFactory<T>> {
    return this.optimize()(input as any) as any;
  }

  public static for(name: string): Draft {
    return new Draft(name);
  }
}

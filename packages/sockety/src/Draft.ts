import { Buffer } from 'node:buffer';
import * as msgpack from 'msgpackr';
import { generateUuid } from '@sockety/uuid';
// eslint-disable-next-line max-len
import { ContentProducer, ContentProducerSlice, createContentProducer, RequestStream, FileTransfer, RequestBase as RawRequest } from '@sockety/core';
// eslint-disable-next-line max-len
import { action, none, data, messageStart, pipe, dataSize, endStream, parallel, attachStream, filesListHeader, filesList } from '@sockety/core/slices';
import { CreateProducerSlice, RequestDone } from '@sockety/core/src/symbols';
import { FunctionMimic } from './FunctionMimic';

// TODO: Looks like ESLint bug. Investigate.
/* eslint-disable @typescript-eslint/no-shadow */

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
type UseData<
  T extends DraftConfig,
  U extends DraftDataType,
  V = any
> = Omit<T, 'data' | 'dataType'> & { data: U, dataType: V };
type UseFiles<T extends DraftConfig, U extends boolean> = Omit<T, 'files'> & { files: U };

type Input<T extends DraftConfig> =
  (T['data'] extends DraftDataType.msgpack
    ? { data: T['dataType'] }
    : T['data'] extends DraftDataType.raw ? { data: Buffer } : {}) &
  (T['files'] extends true ? { files: FileTransfer[] } : {});

type ProducerFactory<T extends DraftConfig> = [keyof Input<T>] extends [never]
  ? (input?: Input<T>) => ContentProducer<RawRequest<T['stream']>>
  : (input: Input<T>) => ContentProducer<RawRequest<T['stream']>>;

interface DataOperation {
  dataSlice: ContentProducerSlice;
  dataSizeSlice: ContentProducerSlice;
  dataLength: number;
}

function createDataOperationObject(
  dataSlice: ContentProducerSlice,
  dataSizeSlice: ContentProducerSlice,
  dataLength: number,
): DataOperation {
  return { dataSlice, dataSizeSlice, dataLength };
}

const noDataOperation = createDataOperationObject(none, dataSize.empty, 0);
function createRawDataOperation(content: Buffer | string): DataOperation {
  const length = Buffer.byteLength(content);
  if (length === 0) {
    return noDataOperation;
  }
  return createDataOperationObject(data(content), dataSize(length), length);
}

function createMessagePackDataOperation(content: any): DataOperation {
  return createRawDataOperation(msgpack.encode(content));
}

interface FilesOperation {
  filesSlice: ContentProducerSlice;
  filesHeaderSlice: ContentProducerSlice;
  filesCount: number;
  totalFilesSize: number;
}

function createFilesOperationObject(
  filesSlice: ContentProducerSlice,
  filesHeaderSlice: ContentProducerSlice,
  filesCount: number,
  totalFilesSize: number,
): FilesOperation {
  return { filesSlice, filesHeaderSlice, filesCount, totalFilesSize };
}

const noFilesOperation = createFilesOperationObject(none, filesListHeader.empty, 0, 0);
function createFilesOperation(files: FileTransfer[]): FilesOperation {
  // Count files
  const filesCount = files.length;

  // Fast-track when there are no files
  if (filesCount === 0) {
    return noFilesOperation;
  }

  // Build slices for files transfer
  const filesSlice = parallel(files.map((file, index) => file[CreateProducerSlice](index)));

  // Compute size
  const totalFilesSize = files.reduce((acc, file) => acc + file.size, 0) || 0;

  // Build header
  const filesSpecSlice = filesListHeader(filesCount, totalFilesSize);
  const filesHeaderSlice = filesList(files);

  return createFilesOperationObject(filesSlice, pipe([ filesSpecSlice, filesHeaderSlice ]), filesCount, totalFilesSize);
}

// TODO: Clean up code
export class Draft<T extends DraftConfig = DraftConfigDefaults> extends FunctionMimic<ProducerFactory<T>> {
  #stream: boolean = false;
  #allowFiles: boolean = false;
  #allowData: DraftDataType = DraftDataType.none;

  // Keep pre-prepared operations
  readonly #action: ContentProducerSlice;
  readonly #actionLength: number;
  #files: (files: FileTransfer[]) => FilesOperation = () => noFilesOperation;
  #data: (data: Buffer) => DataOperation = () => noDataOperation;

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

    return ((input?: Input<T>, argThatIsNotExpected?: number) => {
      // Handle common developer's mistake,
      // that Draft was passed for sending without building draft.
      // `send(Draft.for('ping'))` instead of `send(Draft.for('ping')())`
      if (argThatIsNotExpected !== undefined) {
        throw new Error('Raw Draft\'s factory should be called to build the producer.');
      }

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
      const { dataSlice, dataSizeSlice, dataLength } = createDataSlices(inputData);
      const { filesSlice, filesHeaderSlice, filesCount, totalFilesSize } = createFilesSlices(inputFiles);
      const createMessageStartSlice = createMessageStartSliceFactory(dataLength, filesCount, totalFilesSize);

      return createContentProducer((writer, sent, registered, expectsResponse) => {
        const id = generateUuid();
        const stream = hasStream && expectsResponse ? new RequestStream(writer) : null;
        const request = new RawRequest(id, stream);

        writer.reserveChannel((channel, release) => {
          const finalSent = (error: Error | null | undefined) => {
            sent(error);
            request[RequestDone](error);
          };

          const finalRegistered = () => {
            release();
            registered();
          };

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
          ])(writer, finalSent, finalRegistered, channel);
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

  public mimic(input?: Input<T>, argThatIsNotExpected?: number): ReturnType<ProducerFactory<T>> {
    return (this.optimize() as any)(input, argThatIsNotExpected);
  }

  public static for(name: string): Draft {
    return new Draft(name);
  }
}

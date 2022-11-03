import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { generateUuid } from '@sockety/uuid';
import { createContentProducer, ContentProducer } from './ContentProducer';
import { Request, REQUEST_DONE } from './Request';
import { RequestStream } from './RequestStream';
import { action } from './slices/action';
import { data } from './slices/data';
import { fileContent } from './slices/fileContent';
import { fileEnd } from './slices/fileEnd';
import { messageStart } from './slices/messageStart';
import { fileStream } from './slices/fileStream';
import { dataSize } from './slices/dataSize';
import { attachStream } from './slices/attachStream';
import { filesListHeader } from './slices/filesListHeader';
import { filesList } from './slices/filesList';
import { pipe } from './slices/pipe';
import { endStream } from './slices/endStream';
import { parallel } from './slices/parallel';

// TODO: Extract type
type FileSent = { name: string, buffer: Buffer } | { name: string, size: number, stream: Readable };

export interface CreateMessageOptions {
  action: string;
  data?: Buffer;
  files?: FileSent[];
}

// TODO: Validate provided data? Or on receive?
// TODO: Lazy compute for better initial performance?
export function createMessage<T extends boolean>({
  action: actionName,
  data: rawData,
  files,
}: CreateMessageOptions, hasStream: T): ContentProducer<Request<T>> {
  // Compute action information
  const actionLength = Buffer.byteLength(actionName);
  const actionSlice = action(actionName);

  // Compute data details
  const dataLength = rawData?.length || 0;
  const dataSlice = data(rawData);
  const dataSizeSlice = dataSize(dataLength);

  // Compute files details
  const filesCount = files?.length || 0;
  // @ts-ignore: avoid checks for better performance
  const totalFilesSize = files?.reduce((acc, file) => acc + (file.size ?? file.buffer.length), 0) || 0;

  const filesSpecSlice = filesListHeader(filesCount, totalFilesSize);
  const filesListSlice = filesList(files);

  // Compute message start information
  const messageStartSlice = messageStart(hasStream, actionLength)(dataLength, filesCount, totalFilesSize);

  // Build message producer
  return createContentProducer((writer, sent, written, expectsResponse) => {
    const id = generateUuid();
    const stream = hasStream && expectsResponse ? new RequestStream(writer) : null;
    const request = new Request(id, stream);

    // TODO: Think about "Abort" on "Revoke"
    writer.reserveChannel((channelId, release) => {
      // State
      const callback = (error: Error | null | undefined) => {
        sent(error);
        request[REQUEST_DONE](error);
      };

      const operations = [
        // Write message header
        messageStartSlice(id, expectsResponse),
        actionSlice,
        dataSizeSlice,
        filesSpecSlice,
        filesListSlice,
      ];

      const parallelActions = [
        dataSlice,
        attachStream(stream),
      ];

      if (hasStream && !expectsResponse) {
        parallelActions.push(endStream);
      }

      // Write/schedule files
      // TODO: For 0-size, it should be optional
      // TODO: Make it asynchronously (& drain & ensure channel)
      // TODO: Max concurrency?
      for (let index = 0; index < filesCount; index++) {
        const file = files![index];
        // FIXME: 'in' performance
        if ('buffer' in file) {
          parallelActions.push(pipe([
            fileContent(index)(file.buffer),
            fileEnd(index),
          ]))
        } else {
          parallelActions.push(fileStream(index, file.stream));
        }
      }

      // Add parallel actions
      operations.push(parallel(parallelActions));

      pipe(operations)(writer, channelId, callback, written, release);
    });

    return request;
  });
}

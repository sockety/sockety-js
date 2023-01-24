import { Buffer } from 'node:buffer';
import { createContentProducerSlice } from '../ContentProducer';
import { createNumberBytesGetter } from '../utils/createNumberBytesGetter';
import { createNumberBytesMapper } from '../utils/createNumberBytesMapper';
import { FileNameSizeBits, FileSizeBits } from '../bits';
import { FileTransfer } from '../FileTransfer';
import { none } from './none';

const getFileHeaderNameBytes = createNumberBytesGetter('file name', [ 1, 2 ]);
const getFileHeaderNameFlag = createNumberBytesMapper('file name', {
  1: FileNameSizeBits.Uint8,
  2: FileNameSizeBits.Uint16,
});

const getFileHeaderSizeBytes = createNumberBytesGetter('file size', [ 1, 2, 3, 6 ]);
const getFileHeaderSizeFlag = createNumberBytesMapper('file size', {
  1: FileSizeBits.Uint8,
  2: FileSizeBits.Uint16,
  3: FileSizeBits.Uint24,
  6: FileSizeBits.Uint48,
});

// TODO: Extract type
function getFileHeaderSize(file: FileTransfer): number {
  const nameLength = Buffer.byteLength(file.name);
  const nameSize = getFileHeaderNameBytes(nameLength);
  const { size } = file;
  const sizeSize = getFileHeaderSizeBytes(size);
  return 1 + sizeSize + nameSize + nameLength;
}

function writeFileHeader(buffer: Buffer, offset: number, file: FileTransfer): number {
  const { name, size } = file;
  const nameLength = Buffer.byteLength(name);
  const nameSize = getFileHeaderNameBytes(nameLength);
  const nameBits = getFileHeaderNameFlag(nameLength);
  const sizeSize = getFileHeaderSizeBytes(size);
  const sizeBits = getFileHeaderSizeFlag(size);

  // Write header
  buffer[offset++] = sizeBits | nameBits;

  // Write file size
  buffer.writeUintLE(size, offset, sizeSize);
  offset += sizeSize;

  // Write name size
  buffer.writeUintLE(nameLength, offset, nameSize);
  offset += nameSize;

  // Write name
  offset += buffer.write(name, offset);

  return offset;
}

// TODO: Optimize
export function filesList(files?: FileTransfer[] | null) {
  if (!files || files.length === 0) {
    return none;
  }
  // TODO: Consider doing it lazily?
  const filesHeaderSize = files?.reduce((acc, file) => acc + getFileHeaderSize(file), 0) || 0;
  const filesHeaderBuffer = Buffer.allocUnsafeSlow(filesHeaderSize);
  let offset = 0;
  for (const file of files || []) {
    offset = writeFileHeader(filesHeaderBuffer, offset, file);
  }
  return createContentProducerSlice((writer, sent, registered, channel) => {
    writer.channel(channel);
    writer.continueMessage();
    writer.writeBuffer(filesHeaderBuffer, sent);
    registered();
  });
}

// Packet type:
// Takes first 4 bits of packet header - 0bXXXX0000
export enum PacketTypeBits {
  ChannelSwitchLow = 0 << 4,
  ChannelSwitch = 1 << 4,
  Message = 2 << 4,
  FastReplyLow = 3 << 4,
  FastReply = 4 << 4,
  Response = 5 << 4,
  Continue = 6 << 4,
  Stream = 7 << 4,
  StreamEnd = 8 << 4,
  Abort = 9 << 4,
  Heartbeat = 10 << 4,
  GoAway = 11 << 4,
  File = 12 << 4,
  FileEnd = 13 << 4,
  Data = 14 << 4,
}

export enum FastReply {
  Accept = 0,
  Reject = 1,
  NotImplemented = 2,
  Unauthorized = 3,
  BadRequest = 4,
  InternalError = 5,
}

export const FastReplyDescription: Record<FastReply, string> = {
  [FastReply.Accept]: 'Accepted',
  [FastReply.Reject]: 'Rejected',
  [FastReply.NotImplemented]: 'Not Implemented',
  [FastReply.Unauthorized]: 'Unauthorized',
  [FastReply.BadRequest]: 'Bad Request',
  [FastReply.InternalError]: 'Internal Error',
};

export function isKnownFastReply(response: unknown): response is FastReply {
  return typeof response === 'number' && !!(FastReplyDescription as any)[response];
}

export function getResponseDescription(response: FastReply | number | any): string | null {
  if (isKnownFastReply(response)) {
    return FastReplyDescription[response];
  }
  return typeof response === 'number' ? `Custom #${response}` : null;
}

// Control byte - channel size:
// Takes last two bits of control byte - 0b000000XX
export enum ControlChannelBits {
  Single = 0 << 0,
  Uint8 = 1 << 0,
  Uint16 = 2 << 0,
  Maximum = 3 << 0,
}

// File packet size bucket:
// Takes next 2 bits of packet header - 0b000000XX
// It's ignored for different packet types than File and FileEnd
export enum FileIndexBits {
  First = 0 << 0,
  Uint8 = 1 << 0,
  Uint16 = 2 << 0,
  Uint24 = 3 << 0,
}

// File packet size bucket:
// Takes last 2 bits of packet header - 0b0000XX00
// It's ignored for different packet types than File and FileEnd
// Used also for determining file size bucket in files header, as 0b000000XX.
export enum FileSizeBits {
  Uint8 = 0 << 2,
  Uint16 = 1 << 2,
  Uint24 = 2 << 2,
  Uint48 = 3 << 2,
}

// Used to determine file name bucket in files header, as 0b000000X0.
export enum FileNameSizeBits {
  Uint8 = 0 << 1,
  Uint16 = 1 << 1,
}

// Packet size bucket:
// Takes next 2 bits of packet header - 0b0000XX00
// It's ignored for different packet types than Message, Continuation, Stream, Data and Response.
export enum PacketSizeBits {
  Uint8 = 0 << 2,
  Uint16 = 1 << 2,
  Uint24 = 2 << 2,
  Uint32 = 3 << 2,
}

// Stream existence:
// Takes next 1 bit of packet header - 0b000000X0
// It's ignored for different packet types than Message and Response.
export enum PacketStreamBits {
  No = 0 << 1,
  Yes = 1 << 1,
}

// Response expectation:
// Takes last 1 bit of packet header - 0b0000000X
// It's ignored for different packet types than Message and Response.
export enum PacketResponseBits {
  No = 0 << 0,
  Yes = 1 << 0,
}

// Data size's size bucket:
// Takes first 2 bits of message flags - 0bXX000000
export enum MessageDataSizeBits {
  None = 0 << 6,
  Uint8 = 1 << 6,
  Uint16 = 2 << 6,
  Uint48 = 3 << 6,
}

// Files count size bucket:
// Takes next 2 bits of message flags - 0b00XX0000
export enum MessageFilesCountBits {
  None = 0 << 4,
  Uint8 = 1 << 4,
  Uint16 = 2 << 4,
  Uint24 = 3 << 4,
}

// Total files size's size bucket:
// Takes next 2 bits of message flags - 0b0000XX00
export enum MessageFilesSizeBits {
  Uint16 = 0 << 2,
  Uint24 = 1 << 2,
  Uint32 = 2 << 2,
  Uint48 = 3 << 2,
}

// Action length bucket:
// Takes next 1 bit of message flags - 0b000000X0
export enum MessageActionSizeBits {
  Uint8 = 0 << 1,
  Uint16 = 1 << 1,
}

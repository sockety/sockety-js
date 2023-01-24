import { assertUniqueBitmaskEnum } from './assertUniqueBitmaskEnum';

export enum FastReply {
  Accept = 0,
  Reject = 1,
  NotImplemented = 2,
  Unauthorized = 3,
  BadRequest = 4,
  InternalError = 5,
}
assertUniqueBitmaskEnum(0b111, FastReply);

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

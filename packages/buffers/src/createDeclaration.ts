import { BufferReadOperation } from './BufferReadOperation';

export interface Declaration<T extends any[]> {
  read: (...args: T) => (operation: BufferReadOperation, prefix: string) => void;
}

export function createDeclaration<T extends any[]>(declaration: Declaration<T>): Declaration<T> {
  return declaration;
}

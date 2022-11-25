// Common symbols
export const Push = Symbol();
export const Close = Symbol();
export const End = Symbol();
export const Ended = Symbol();
export const Abort = Symbol();
export const CreateProducerSlice = Symbol();

// Stream-related
export const EndStream = Symbol();
export const ConsumeStream = Symbol();
export const AttachStream = Symbol();

// Data-related
export const ConsumeData = Symbol();

// Files-related
export const ConsumeFilesHeader = Symbol();
export const ConsumeFile = Symbol();
export const EndFile = Symbol();

// Request-related
export const RequestDone = Symbol();

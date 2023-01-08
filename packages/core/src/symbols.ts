// Common symbols
export const Push = Symbol('method for pushing data');
export const Close = Symbol('method for closing stream');
export const End = Symbol('method to notify about end of data');
export const Ended = Symbol('property to check if it is ended');
export const Abort = Symbol('method for aborting');
export const CreateProducerSlice = Symbol('method for creating slice to send');

// Stream-related
export const EndStream = Symbol('method to end Stream');
export const ConsumeStream = Symbol('method to consume Stream');
export const AttachStream = Symbol('method to attach Stream');

// Data-related
export const ConsumeData = Symbol('method to consume Data');

// Files-related
export const ConsumeFilesHeader = Symbol('method to consume files header');
export const ConsumeFile = Symbol('method to consume File data');
export const EndFile = Symbol('method to notify about end of file');

// Request-related
export const RequestDone = Symbol('method to notify about end of request');

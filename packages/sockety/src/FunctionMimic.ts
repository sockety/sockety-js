// @see: {@link https://stackoverflow.com/a/40878674/2922986}
export abstract class FunctionMimic<T extends (...args: any) => any> extends Function {
  private readonly __self__: this;

  protected constructor() {
    super('...args', 'return this.__self__.__call__(...args)');
    this.__self__ = this.bind(this);

    return this.__self__;
  }

  protected abstract __call__(...args: Parameters<T>): ReturnType<T>;
}

export interface FunctionMimic<T extends (...args: any) => any> {
  (...args: Parameters<T>): ReturnType<T>;
}

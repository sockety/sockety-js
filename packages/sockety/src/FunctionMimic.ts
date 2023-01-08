// @see: {@link https://stackoverflow.com/a/40878674/2922986}
export abstract class FunctionMimic<T extends (...args: any) => any> extends Function {
  private readonly selfMimic: this;

  protected constructor() {
    super('...args', 'return this.selfMimic.mimic(...args)');
    this.selfMimic = this.bind(this);

    // eslint-disable-next-line no-constructor-return
    return this.selfMimic;
  }

  protected abstract mimic(...args: Parameters<T>): ReturnType<T>;
}

export interface FunctionMimic<T extends (...args: any) => any> {
  (...args: Parameters<T>): ReturnType<T>;
}

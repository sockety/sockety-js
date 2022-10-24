export interface BufferSnippetScopeInfo {
  readVariables: string[];
  escapes: string[];
  goes: string[];
  maySelfEscape: boolean;
  mayEscape: boolean;
  mayContinue: boolean;
  mayGo: boolean;
  maySet: boolean;
  mayEmit: boolean;
  readsBuffer: boolean;
}

const unique = <T>(list: T[]): T[] => list.filter((x, i, a) => a.indexOf(x) === i);

export class BufferSnippetScope {
  readonly #name: string;
  readonly #escapes: string[] = [];
  readonly #goes: string[] = [];
  readonly #readVariables: string[] = [];
  #maySelfEscape = false;
  #mayEscape = false;
  #mayContinue = false;
  #mayGo = false;
  #maySet = false;
  #mayEmit = false;
  #readsBuffer = false;

  public constructor(name: string) {
    this.#name = name;
  }

  public getInfo(): BufferSnippetScopeInfo {
    return {
      readVariables: unique(this.#readVariables),
      escapes: unique(this.#escapes),
      goes: unique(this.#goes),
      maySelfEscape: this.#maySelfEscape,
      mayEscape: this.#mayEscape,
      mayContinue: this.#mayContinue,
      mayGo: this.#mayGo,
      maySet: this.#maySet,
      mayEmit: this.#mayEmit,
      readsBuffer: this.#readsBuffer,
    };
  }

  private get context(): string {
    return '_context';
  }

  public get buffer(): string {
    this.#readsBuffer = true;
    return '_buffer';
  }

  public get offset(): string {
    return '_offset';
  }

  public shift(code: string | number, shift: number): string {
    if (shift < 0) {
      throw new Error('Not supported');
    } else if (shift === 0) {
      return `${code}`;
    } else if (shift > 23) {
      return `((${code} << 23) * ${2 ** (shift - 23)})`;
    }
    return `(${code} << ${shift})`;
  }

  public bufferAt(offset: string | number, shift = 0): string {
    const code = offset === 0 ? `${this.buffer}[${this.offset}]` : `${this.buffer}[${this.offset} + ${offset}]`;
    return this.shift(code, shift);
  }

  public moveOffset(offset: string | number): string {
    return offset === 1 ? `${this.offset}++;` : `${this.offset} += ${offset};`;
  }

  public hasBytes(bytes: string | number = 1): string {
    return bytes === 1
      ? `(${this.offset} < ${this.end} && typeof ${this.buffer}[${this.offset}] !== 'undefined')`
      : `(${this.offset} + ${bytes} <= ${this.end} && typeof ${this.buffer}[${this.offset} + ${bytes} - 1] !== 'undefined')`;
  }

  public get end(): string {
    return '_end';
  }

  public local(name: string): string {
    return `${this.context}.$_${this.#name}_${name}`;
  }

  public read(name = this.#name): string {
    this.#readVariables.push(name);
    return `${this.context}.${name}`;
  }

  public emit(code: string): string {
    this.#mayEmit = true;
    return `${this.context}._emit_${this.#name}(${code});`;
  }

  public onlyWhenUsed(code: string): string {
    return `/*set:start*/${code}/*set:end*/`;
  }

  public set(code: string, emit = true): string {
    this.#maySet = true;
    if (emit) {
      this.#mayEmit = true;
      return `${this.context}._finish_${this.#name}(${code});`;
    }
    return this.onlyWhenUsed(`${this.context}.${this.#name} = ${code};`);
  }

  public escape(name?: string): string {
    if (name) {
      this.#escapes.push(name);
      this.#mayEscape = true;
      return `<<<ESCAPE:${name}>>>`;
    }
    this.#maySelfEscape = true;
    this.#mayEscape = true;
    return '<<<ESCAPE>>>';
  }

  public go(name: string): string {
    this.#goes.push(name);
    this.#mayGo = true;
    return `<<<GO:${name}>>>`;
  }

  public continue(): string {
    this.#mayContinue = true;
    return '<<<CONTINUE>>>';
  }

  public earlyEnd(): string {
    return '<<<EARLY_END>>>';
  }
}

import { isValidVariableName } from './isValidVariableName';
import { BufferSnippetScope, BufferSnippetScopeInfo } from './BufferSnippetScope';

const unique = <T>(list: T[]): T[] => list.filter((x, i, a) => a.indexOf(x) === i);

export interface BufferReadOperationInfo {
  name: string;
  initialValue: string;
  resetValue: boolean;
  headers: string[];
  entry: string;
  variables: Record<string, { code: string, reset: boolean }>;
  snippets: Record<string, { code: string, info: BufferSnippetScopeInfo }>;
  stops: string[];
  pointer: number | null;
}

export class BufferReadOperation {
  readonly #name: string;
  readonly #headers: string[] = [];
  readonly #variables: Record<string, { code: string, reset: boolean }> = {};
  readonly #snippets: Record<string, { code: string, info: BufferSnippetScopeInfo }> = {};
  readonly #stops: string[] = [];
  #entry: string | null = null;
  #initial: string = 'null';
  #reset: boolean = true;

  public constructor(name: string) {
    if (!isValidVariableName(name)) {
      throw new Error(`Name "${name}" is invalid or reserved`);
    }
    this.#name = name;
  }

  /**
   * Validate the name is not used yet in the operation scope.
   */
  #validateName(name: string): void {
    if (this.#variables[name]) {
      throw new Error(`Name "${name}" is already defined as variable`);
    } else if (!isValidVariableName(name)) {
      throw new Error(`Name "${name}" is invalid or reserved`);
    } else if (this.#snippets[name]) {
      throw new Error(`Name "${name}" is already defined as snippet`);
    }
  }

  /**
   * Format value to a code.
   */
  #formatValue(code: string | number | bigint): string {
    if (typeof code === 'bigint') {
      return `${code}n`;
    }
    return `${code}`;
  }

  /**
   * Get the name of read operation.
   */
  public get name(): string {
    return this.#name;
  }

  /**
   * Get final instructions based on designated buffer operation.
   */
  public getInfo(): BufferReadOperationInfo {
    if (!this.#entry) {
      throw new Error('BufferReadOperation needs to have entry code');
    }
    return {
      name: this.#name,
      initialValue: this.#initial,
      resetValue: this.#reset,
      variables: this.#variables,
      headers: this.#headers,
      snippets: this.#snippets,
      entry: this.#entry,
      stops: unique(this.#stops),
      pointer: null,
    };
  }

  /**
   * Set initial value for an operation result.
   */
  public initialValue(code: string | number | bigint): this {
    this.#initial = this.#formatValue(code);
    return this;
  }

  /**
   * Set whether it should reset value when it's no longer needed.
   */
  public resetValue(reset = true): this {
    this.#reset = reset;
    return this;
  }

  /**
   * Declare new local variable that may be used for operation.
   */
  public declare(name: string, code: string | number | bigint, reset = true): this {
    // Validate the variable name
    this.#validateName(name);

    // Reformat code
    if (typeof code === 'bigint') {
      code = `${code}n`;
    }

    // Save
    this.#variables[name] = { reset, code: `${code}` };

    return this;
  }

  /**
   * Declare a code header, that may be used to i.e. require some external library.
   */
  public header(code: string, skipWhitespaces = false): this {
    // Reduce code size and ensure less duplicates
    if (skipWhitespaces) {
      code = code.trim().replace(/\s+/g, ' ');
    }

    // Add new header
    if (!this.#headers.includes(code)) {
      this.#headers.push(code);
    }

    return this;
  }

  /**
   * Add the entry function, which will be initial for this step.
   */
  public entry(fn: (scope: BufferSnippetScope) => string, name = `${this.#name}_entry`): this {
    // Ensure that there is only single entry
    if (this.#entry) {
      throw new Error('There may be only single entry for operation');
    }

    // Add an entry snippet
    this.snippet(name, fn);
    this.#entry = name;
    this.#stops.push(name);

    return this;
  }

  /**
   * Add a snippet, that may be used as an internal step (with option to stop there).
   */
  public snippet(name: string, fn: (scope: BufferSnippetScope) => string): this {
    // Validate the snippet name
    this.#validateName(name);

    // Create new scope & build a function
    const scope = new BufferSnippetScope(this.#name);
    const code = fn(scope);
    this.#snippets[name] = { code, info: scope.getInfo() };

    // Mark all stops
    if (this.#snippets[name].info.maySelfEscape) {
      this.#stops.push(name);
    }
    for (const escape of this.#snippets[name].info.escapes) {
      this.#stops.push(escape);
    }
    for (const next of this.#snippets[name].info.goes) {
      this.#stops.push(next);
    }

    return this;
  }
}

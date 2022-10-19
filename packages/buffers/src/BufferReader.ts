import type { ConditionalKeys, JsonValue } from 'type-fest';
import { UUID } from '@sockety/uuid';
import { BufferReadOperation, BufferReadOperationInfo } from './BufferReadOperation';
import { isValidVariableName } from './isValidVariableName';
import { uint8Declaration } from './declarations/uint8Declaration';
import { uint16leDeclaration } from './declarations/uint16leDeclaration';
import { BufferSnippetScope, BufferSnippetScopeInfo } from './BufferSnippetScope';
import { rawDynamicDeclaration, rawDynamicDeclarationContinuous } from './declarations/rawDynamicDeclaration';
import { biguint64leDeclaration } from './declarations/biguint64leDeclaration';
import { uint24leDeclaration } from './declarations/uint24leDeclaration';
import { uint32leDeclaration } from './declarations/uint32leDeclaration';
import { uint40leDeclaration } from './declarations/uint40leDeclaration';
import { uint48leDeclaration } from './declarations/uint48leDeclaration';
import { biguint56leDeclaration } from './declarations/biguint56leDeclaration';
import { uuidDeclaration } from './declarations/uuidDeclaration';
import { uuidStringDeclaration } from './declarations/uuidStringDeclaration';
import { rawDeclaration, rawDeclarationContinuous } from './declarations/rawDeclaration';
import { utf8Declaration } from './declarations/utf8Declaration';
import { utf8DynamicDeclaration } from './declarations/utf8DynamicDeclaration';
import { constantDeclaration } from './declarations/constantDeclaration';
import { arrayContinuousDeclaration, arrayDeclaration } from './declarations/arrayDeclaration';
import { arrayDynamicContinuousDeclaration, arrayDynamicDeclaration } from './declarations/arrayDynamicDeclaration';

/* eslint-disable quotes */

export class BufferReader<T extends Record<string, any> = {}> {
  readonly #operations: BufferReadOperationInfo[] = [];
  readonly #names: string[] = [];
  readonly #internal: string[] = [];
  #pointerId = 10000; // TODO: Disable possibility of having more than 9999 operations then

  /**
   * Validate whether the name may be used by another step.
   */
  #validateName(name: string): void {
    if (!isValidVariableName(name)) {
      throw new Error(`Name "${name}" is invalid or reserved variable name`);
    }
  }

  /**
   * Validate and reserve name for a step.
   */
  #registerName(name: string): void {
    this.#validateName(name);
    this.#names.push(name);
  }

  /**
   * Validate and reserve name for a step, prepare the operation info.
   */
  #registerOperation(name: string, fn: (operation: BufferReadOperation, prefix: string) => void): void {
    this.#registerName(name);
    const operation = new BufferReadOperation(name);
    fn(operation, `$_${this.#operations.length}_`);
    this.#operations.push(operation.getInfo());
  }

  /**
   * Add new code pointer to allow jumping.
   */
  #pointer(): number {
    this.custom(($) => $.continue());
    const pointer = this.#pointerId++;
    this.#operations[this.#operations.length - 1].pointer = pointer;
    return pointer;
  }

  /**
   * Mark variable as internal, so it will not be exposed unnecessarily for i.e. arrays.
   */
  public setInternal(name: keyof T): this {
    this.#internal.push(name as any);
    return this;
  }

  /**
   * Get registered names, with their initial code.
   * It's needed for array, to see what should be exposed.
   */
  public getVariables(): Record<string, string> {
    return this.#operations
      .filter((operation) => !this.#internal.includes(operation.name))
      .reduce((variables, operation) => ({
        ...variables,
        [operation.name]: operation.initialValue,
      }), {} as Record<string, string>);
  }

  /**
   * Add step for unsigned int8.
   *
   * Size:      1 byte
   * Value:     0 - 255
   * Describes: 255B
   */
  public uint8<K extends string>(name: K): BufferReader<T & Record<K, number>> {
    this.#registerOperation(name, uint8Declaration.read());
    return this;
  }

  /**
   * Add step for unsigned int16 little endian.
   *
   * Size:      2 bytes
   * Value:     0 - 65,535
   * Describes: ~64 KiB
   */
  public uint16le<K extends string>(name: K): BufferReader<T & Record<K, number>> {
    this.#registerOperation(name, uint16leDeclaration.read());
    return this;
  }

  /**
   * Add step for unsigned int24 little endian.
   *
   * Size:      3 bytes
   * Value:     0 - 16,777,215
   * Describes: ~16 MiB
   */
  public uint24le<K extends string>(name: K): BufferReader<T & Record<K, number>> {
    this.#registerOperation(name, uint24leDeclaration.read());
    return this;
  }

  /**
   * Add step for unsigned int32 little endian.
   *
   * Size:      4 bytes
   * Value:     0 - 4,294,967,295
   * Describes: ~4 GiB
   */
  public uint32le<K extends string>(name: K): BufferReader<T & Record<K, number>> {
    this.#registerOperation(name, uint32leDeclaration.read());
    return this;
  }

  /**
   * Add step for unsigned int40 little endian.
   *
   * Size:      5 bytes
   * Value:     0 - 1,099,511,627,775
   * Describes: ~1 TiB
   */
  public uint40le<K extends string>(name: K): BufferReader<T & Record<K, number>> {
    this.#registerOperation(name, uint40leDeclaration.read());
    return this;
  }

  /**
   * Add step for unsigned int48 little endian.
   *
   * Size:      6 bytes
   * Value:     0 - 281,474,976,710,655
   * Describes: ~256 TiB
   */
  public uint48le<K extends string>(name: K): BufferReader<T & Record<K, number>> {
    this.#registerOperation(name, uint48leDeclaration.read());
    return this;
  }

  /**
   * Add step for unsigned int56 little endian.
   * Needs to use bigint, as it's over JS number precision.
   *
   * Size:      7 bytes
   * Value:     0 - 72,057,594,037,927,935
   * Describes: ~64 PiB
   */
  public biguint56le<K extends string>(name: K): BufferReader<T & Record<K, bigint>> {
    this.#registerOperation(name, biguint56leDeclaration.read());
    return this;
  }

  /**
   * Add step for unsigned int64 little endian.
   * Needs to use bigint, as it's over JS number precision.
   *
   * Size:      8 bytes
   * Value:     0 - 18,446,744,073,709,551,615
   * Describes: ~16 EiB
   */
  public biguint64le<K extends string>(name: K): BufferReader<T & Record<K, bigint>> {
    this.#registerOperation(name, biguint64leDeclaration.read());
    return this;
  }

  /**
   * Add step for UUID v4, and return as Sockety's UUID instance.
   *
   * Size:      16 bytes
   */
  public uuid<K extends string>(name: K): BufferReader<T & Record<K, UUID>> {
    this.#registerOperation(name, uuidDeclaration.read());
    return this;
  }

  /**
   * Add step for UUID v4, and return as a string.
   *
   * Size:      16 bytes
   */
  public uuidString<K extends string>(name: K): BufferReader<T & Record<K, string>> {
    this.#registerOperation(name, uuidStringDeclaration.read());
    return this;
  }

  /**
   * Add step for raw buffer.
   *
   * May be `continuous`, so it will emit every chunk found, instead of waiting for full result.
   */
  public raw<K extends string>(name: K, length: number, continuous = false): BufferReader<T & Record<K, Buffer>> {
    const implementation = continuous ? rawDeclarationContinuous : rawDeclaration;
    this.#registerOperation(name, implementation.read(length));
    return this;
  }

  /**
   * Add step for raw buffer of size of different (lengthKey) parameter.
   *
   * May be `continuous`, so it will emit every chunk found, instead of waiting for full result.
   */
  public rawDynamic<K extends string>(
    name: K,
    lengthKey: ConditionalKeys<T, bigint | number>,
    continuous = false,
  ): BufferReader<T & Record<K, Buffer>> {
    const implementation = continuous ? rawDynamicDeclarationContinuous : rawDynamicDeclaration;
    this.#registerOperation(name, implementation.read(lengthKey as any));
    return this;
  }

  /**
   * Add step for UTF-8 representation in buffer.
   */
  public utf8<K extends string>(name: K, length: number): BufferReader<T & Record<K, string>> {
    this.#registerOperation(name, utf8Declaration.read(length));
    return this;
  }

  /**
   * Add step for UTF-8 representation in buffer of size of different (lengthKey) parameter.
   */
  public utf8Dynamic<K extends string>(
    name: K,
    lengthKey: ConditionalKeys<T, bigint | number>,
  ): BufferReader<T & Record<K, string>> {
    this.#registerOperation(name, utf8DynamicDeclaration.read(lengthKey as any));
    return this;
  }

  /**
   * Add step to emit some constant known primitive value.
   */
  public constant<K extends string, U extends JsonValue | undefined>(name: K, value: U): BufferReader<T & Record<K, U>> {
    this.#registerOperation(name, constantDeclaration.read(value));
    return this;
  }

  /**
   * Add step to read array of different buffer reader specs.
   *
   * May be `continuous`, so it will emit every chunk found, instead of waiting for full result.
   */
  public array<K extends string, U>(
    name: K,
    length: number,
    fn: (factory: BufferReader) => BufferReader<U>,
    continuous = false,
  ): BufferReader<T & Record<K, U[]>> {
    const implementation = continuous ? arrayContinuousDeclaration : arrayDeclaration;
    const innerReader = fn(new BufferReader());
    this.#registerOperation(name, implementation.read(length, innerReader));
    return this;
  }

  /**
   * Add step to read array of different buffer reader specs,
   * where number of elements is based on different parameter (lengthKey).
   *
   * May be `continuous`, so it will emit every chunk found, instead of waiting for full result.
   */
  public arrayDynamic<K extends string, U>(
    name: K,
    lengthKey: ConditionalKeys<T, bigint | number>,
    fn: (factory: BufferReader) => BufferReader<U>,
    continuous = false,
  ): BufferReader<T & Record<K, U[]>> {
    const implementation = continuous ? arrayDynamicContinuousDeclaration : arrayDynamicDeclaration;
    const innerReader = fn(new BufferReader());
    this.#registerOperation(name, implementation.read(lengthKey as any, innerReader));
    return this;
  }

  /**
   * Run additional different buffer reader specs,
   * when some different parameter (name) has some specific value (value).
   *
   * TODO: Clean up this code (along with pointers), as it's pretty hacky.
   */
  public when<K extends ConditionalKeys<T, bigint | number | boolean | string>, U extends T>(
    name: K,
    value: K extends keyof T ? T[K] : never,
    fn: (factory: BufferReader<T>) => BufferReader<U>,
  ): BufferReader<U> {
    // Cache information about current number of operations
    const length = this.#operations.length;

    // Add conditional steps
    fn(this);

    // Add a pointer where it may jump to
    const pointer = this.#pointer();

    // Add condition to decide whether to continue or jump,
    // and place it before the conditional steps.
    this.custom(($) => `
      if (${$.read(name as string)} === ${typeof value === 'bigint' ? `${value}n` : JSON.stringify(value)}) {
        ${$.continue()}
      }
      <<<JUMP:${pointer}>>>
    `);
    this.#operations.splice(length, 0, this.#operations.pop()!);

    return this as any;
  }

  /**
   * Read some bitwise flag (value) from different parameter (sourceKey).
   */
  public flag<K extends string>(
    name: K,
    sourceKey: ConditionalKeys<T, number>,
    value: number,
  ): BufferReader<T & Record<K, boolean>> {
    this.#registerOperation(name, (x) => x
      .initialValue('null')
      .resetValue(false)
      .entry(($) => `
        ${$.set(`(${$.read(sourceKey as string)} & ${value}) === ${value}`)}
        ${$.continue()}
      `));
    return this as any;
  }

  /**
   * Read some bitwise flag (value) from different parameter (sourceKey).
   */
  public mask<K extends string, U = number>(
    name: K,
    sourceKey: ConditionalKeys<T, number>,
    mask: number,
  ): BufferReader<T & Record<K, U>> {
    this.#registerOperation(name, (x) => x
      .initialValue('0')
      .resetValue(false)
      .entry(($) => `
        ${$.set(`${$.read(sourceKey as string)} & ${mask}`)}
        ${$.continue()}
      `));
    return this as any;
  }

  /**
   * Run custom code snippet.
   */
  public custom(fn: (scope: BufferSnippetScope, prefix: string) => string): BufferReader<T> {
    const name = `ee_${`${Math.random()}`.replace(/\./, '_')}`;
    this.#registerOperation(name, (operation, prefix) => operation
      .initialValue('null')
      .resetValue(false)
      .entry((scope) => fn(scope, prefix)));
    this.setInternal(name);
    return this;
  }

  /**
   * Run custom code snippet.
   */
  public compute<K extends string, U>(
    name: K,
    fn: (scope: BufferSnippetScope, prefix: string) => string
  ): BufferReader<T & Record<K, U>> {
    this.#registerOperation(name, (operation, prefix) => operation
      .initialValue('null')
      .resetValue(false)
      .entry(($) => `
        const execute = () => {${fn($, prefix)}}
        ${$.set('execute()')}
        ${$.continue()}
      `));
    return this;
  }

  /**
   * Restart the chain immediately, before the chain ends.
   */
  public earlyEnd(): BufferReader<T> {
    return this.custom(($) => $.earlyEnd());
  }

  /**
   * Throw an error.
   */
  public fail(message: string, type = 'Error'): BufferReader<T> {
    return this.custom(() => `throw new ${type}(${JSON.stringify(message)});`);
  }

  /**
   * Build code for factory for reader functions.
   */
  public build(prefix: string = ''): string {
    let fn = '';

    // Analyze data
    const operationsMap: Record<string, BufferReadOperationInfo> = {};
    const snippetIdsMap = new WeakMap<{ code: string, info: BufferSnippetScopeInfo }, number>();
    const alwaysEscapedMap = new WeakMap<{ code: string, info: BufferSnippetScopeInfo }, boolean>();
    let snippetIndex = 1;
    for (const operation of this.#operations) {
      operationsMap[operation.name] = operation;
      for (const [ name, snippet ] of Object.entries(operation.snippets)) {
        // Either use hardcoded pointer ID or generated one
        if (operation.pointer && operation.entry === name) {
          snippetIdsMap.set(snippet, operation.pointer);
        } else {
          snippetIdsMap.set(snippet, snippetIndex++);
        }

        // Decide whether it's always escaped or not
        alwaysEscapedMap.set(
          snippet,
          (
            operation.entry !== name &&
            !Object.values(operation.snippets).find((x) => x.info.goes.includes(name))
          ),
        );
      }
    }

    // Extract information about stops
    const allStops = this.#operations.map((x) => x.stops.map((stop) => x.snippets[stop])).flat();

    // Build constants
    fn += `  const ${prefix}_noop = () => {};\n\n`;

    // Load headers
    fn += this.#operations.map((x) => x.headers).flat()
      .filter((x, i, a) => a.indexOf(x) === i)
      .map((x) => `${x}\n`)
      .join('');

    // Build context class
    fn += `\n  class ${prefix}Context {\n`;
    fn += `    _step = 1;\n`;

    // Initialize variables
    for (const { name, initialValue } of this.#operations) {
      if (initialValue === undefined) {
        fn += `    ${name};\n`;
      } else {
        fn += `    ${name} = ${initialValue};\n`;
      }
    }

    // Initialize constructor
    fn += `\n    constructor(callbacks) {\n`;
    for (const { name } of this.#operations) {
      fn += `      this._emit_${name} = callbacks.${name} || ${prefix}_noop;\n`;
    }
    fn += `      this._emit__end = callbacks._end || ${prefix}_noop;\n`;
    fn += `    }\n\n`;

    fn += `    _go(step) {\n`;
    fn += `      this._step = step;\n`;
    fn += `    }\n\n`;

    // Initialize methods to manipulate variables
    for (const { name } of this.#operations) {
      fn += `    _finish_${name}(value) {\n`;
      fn += `      this.${name} = value;\n`;
      fn += `      this._emit_${name}(value);\n`;
      fn += `    }\n`;
    }

    fn += `  }\n`;

    function getUsedGlobalVariables(operation: BufferReadOperationInfo): string[] {
      return Object.values(operation.snippets)
        .map((x) => x.info.readVariables)
        .flat()
        .filter((x, i, a) => a.indexOf(x) === i);
    }

    function getUsedResettableGlobalVariables(operation: BufferReadOperationInfo): string[] {
      return getUsedGlobalVariables(operation)
        .filter((x) => operationsMap[x]?.resetValue);
    }

    // Build all modules
    for (let i = 0; i < this.#operations.length; i++) {
      const operation = this.#operations[i];
      const nextOperation = this.#operations[i + 1];
      const restOperations = this.#operations.slice(i + 1);
      const resettableGlobalVariables = getUsedResettableGlobalVariables(operation)
        .filter((x) => !restOperations.find((o) => getUsedResettableGlobalVariables(o).includes(x)));
      const isUsedLater = Boolean(restOperations.find((o) => getUsedGlobalVariables(o).includes(operation.name)));

      fn += `\n  const { ${operation.stops.map((x) => `${prefix}step${snippetIdsMap.get(operation.snippets[x])}`).join(', ')} } = (function () {\n`;
      fn += Object.entries(operation.variables).map(([ name, { code } ]) => `      let ${name} = ${code};\n`).join('');
      for (const [ name, snippet ] of Object.entries(operation.snippets)) {
        fn += `    function ${name}(_context, _buffer, _offset, _end) {\n`;

        // Detect which variables could be removed
        const continueResetLocalCode = Object.entries(operation.variables)
          .filter(([ , { reset } ]) => reset)
          .map(([ name, { code } ]) => `${name} = ${code}; `)
          .join('');
        const continueResetGlobalCode = resettableGlobalVariables
          .map((name) => `_context.${name} = ${operationsMap[name].initialValue}; `)
          .join('');
        const continueResetCode = continueResetLocalCode + continueResetGlobalCode;

        // Build code
        let result = snippet.code
          .replace(/<<<EARLY_END>>>/g, continueResetCode + `_context._go(1); _context._emit__end(); return _offset;`)
          .replace(/<<<CONTINUE>>>/g, continueResetCode + (nextOperation
            ? `return ${prefix}step${snippetIdsMap.get(nextOperation.snippets[nextOperation.entry])}(_context, _buffer, _offset, _end);`
            : `_context._go(1); _context._emit__end(); return _offset;`))
          .replace(/<<<GO:([^>]+)>>>/g, (_, fnName) => `return ${fnName}(_context, _buffer, _offset, _end);`)
          .replace(/<<<JUMP:([0-9]+)>>>/g, (_, id) => continueResetCode + `return ${prefix}step${id}(_context, _buffer, _offset, _end);`)
          .replace(/<<<ESCAPE>>>/g, `_context._go(${snippetIdsMap.get(snippet)}); return _offset;`)
          .replace(/<<<ESCAPE:([^>]+)>>>/g, (_, name) => `_context._go(${snippetIdsMap.get(operation.snippets[name])}); return _offset;`);

        // Optimization: Get rid of unnecessary `set`
        if (!isUsedLater) {
          result = result
            .replace(new RegExp(`_context\\._finish_${operation.name}`, 'g'), `_context._emit_${operation.name}`)
            .replace(/\/\*set:start\*\/[^]+?\/\*set:end\*\/\s+/g, '');
        }

        // Optimization: Get rid of unnecessary saving information about escaped step
        if (alwaysEscapedMap.get(snippet) || (i === 0 && name === operation.entry)) {
          result = result.replace(new RegExp(`_context\\._go\\(${snippetIdsMap.get(snippet)}\\);`, 'g'), '');
        }

        // Remove internal comments
        result = result.replace(/\/\*[^*]+?\*\//g, '');

        fn += `      ${result}`;
        fn += `    }\n`;
      }
      fn += `    return {\n`;
      for (const name of operation.stops) {
        fn += `      ${prefix}step${snippetIdsMap.get(operation.snippets[name])}: ${name},\n`;
      }
      fn += `    };\n`;
      fn += `  })();\n`;
    }

    // Create function to read one iteration
    fn += `\n  function ${prefix}readOne(context, buffer, offset = 0, end = Infinity) {\n`;
    fn += `    switch (context._step) {\n`;
    for (const stop of allStops) {
      fn += `      case ${snippetIdsMap.get(stop)}: return ${prefix}step${snippetIdsMap.get(stop)}(context, buffer, offset, end);\n`;
    }
    fn += `    }\n`;
    fn += '  }\n';

    // Create function to read continuously
    fn += `\n  function ${prefix}readMany(context, buffer, offset = 0, end = Infinity) {\n`;
    fn += `    let lOffset = offset | 0;\n`;
    fn += `    let prevOffset = lOffset;\n`;
    fn += `    loop: do {\n`;
    fn += `      prevOffset = lOffset;\n`;
    fn += `      switch (context._step) {\n`;
    for (const stop of allStops) {
      fn += `        case ${snippetIdsMap.get(stop)}: lOffset = ~~${prefix}step${snippetIdsMap.get(stop)}(context, buffer, lOffset, end); continue loop;\n`;
    }
    fn += `      }\n`;
    fn += `    } while (lOffset !== end && lOffset !== prevOffset);\n`;
    fn += '  }\n';

    // Create reader factory
    fn += `\n  function ${prefix}createReader(callbacks = {}) {\n`;
    fn += `    const context = new ${prefix}Context(callbacks);\n`;
    fn += `    return {\n`;
    fn += `      readOne: (buffer, offset, end) => ${prefix}readOne(context, buffer, offset, end),\n`;
    fn += `      readMany: (buffer, offset, end) => ${prefix}readMany(context, buffer, offset, end),\n`;
    fn += `    }\n`;
    fn += `  }\n`;
    return fn;
  }

  /**
   * Build factory for reader functions.
   *
   * FIXME: Internal properties should not have callbacks
   */
  public end(): (callbacks?: Partial<{ [K in keyof T]: ((value: T[K]) => void) }> & { _end?: () => void }) => {
    readOne: (buffer: Uint8Array, offset?: number, end?: number) => number;
    readMany: (buffer: Uint8Array, offset?: number, end?: number) => void;
  } {
    return new Function('require', `${this.build()}\nreturn createReader;`)(require);
  }
}

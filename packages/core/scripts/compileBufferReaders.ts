import * as fs from 'node:fs';
import * as path from 'node:path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { minify as rawMinify } from 'terser';
import { BufferReader } from '@sockety/buffers';

async function minify(code: string): Promise<string> {
  const result = await rawMinify({ 'file.js': code }, {
    toplevel: true,
    ecma: 2020,
    compress: {
      ecma: 2020,
      unsafe_arrows: true,
      hoist_funs: true,
      booleans: false,
      sequences: false,
      passes: 2,
    },
  });
  if (!result || !result.code) {
    throw new Error('There was a problem with minification');
  }
  return result.code;
}

// Configure

const readersPath = path.join(__dirname, '..', 'src', 'buffer-readers');

// Extract readers names

const readersNames = fs.readdirSync(readersPath)
  .filter((name) => /^(?!.*\.d\.ts$).*\.ts$/.test(name))
  .map((name) => name.replace(/\.ts$/, ''));

// Monkey-patch BufferReader, so end() will not create final factories

// @ts-ignore: monkey patching for reflection
BufferReader.prototype.end = function endMock() {
  return this;
};

// Delete obsolete files

for (const name of readersNames) {
  fs.rmSync(path.join(readersPath, `${name}.js`), { force: true });
  fs.rmSync(path.join(readersPath, `${name}.js.map`), { force: true });
}

// Compile new JS version for each of them

async function main() {
  const header = '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n';
  for (const name of readersNames) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const code = (Object.entries(require(path.join(readersPath, `${name}.ts`))) as [ string, BufferReader<any> ][])
      .map(([ key, reader ]) => (
        `exports[${JSON.stringify(key)}] = (function () { ${reader.build()}; return createReader; })();\n`
      ))
      .join('\n');

    fs.writeFileSync(
      path.join(readersPath, `${name}.js`),
      // eslint-disable-next-line no-await-in-loop
      await minify(`${header}${code}`),
    );
  }
}

// Run and lift error
main().catch((error) => setTimeout(() => { throw error; }));

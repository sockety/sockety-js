const { randomBytes } = require('node:crypto');
const { join } = require('node:path');
const { readFileSync, writeFileSync, rmSync, createReadStream, existsSync } = require('node:fs');

const files = [];
function createStreamFactory(path, watermark) {
  if (watermark == null) {
    return () => createReadStream(path);
  } else {
    const options = { highWaterMark: watermark };
    return () => createReadStream(path, options);
  }
}

function createFile(_name, size) {
  const name = `tmp-${_name}.bin`;
  const path = join(__dirname, name);
  const stream = createStreamFactory(path);
  files.push(path);
  if (existsSync(path)) {
    return { content: readFileSync(path), path, stream };
  }
  const content = randomBytes(size);
  writeFileSync(path, content);
  return { content, path, stream };
}

process.on('exit', () => {
  for (const path of files) {
    rmSync(path, { force: true });
  }
});

for (const event of [ 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2' ]) {
  process.on(event, () => process.exit(2));
}

exports.kb64 = createFile('64kb', 64 * 1024);
exports.kb512 = createFile('512kb', 512 * 1024);
exports.mb1 = createFile('1mb', 1024 * 1024);
exports.mb4 = createFile('4mb', 4 * 1024 * 1024);

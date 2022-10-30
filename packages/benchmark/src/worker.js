const cluster = require('node:cluster');
const os = require('node:os');
const { join } = require('node:path');
const { Worker } = require('node:worker_threads');
const { fork } = require('node:child_process');

function setPriority(priority) {
  try {
    os.setPriority(process.pid, priority);
    return true;
  } catch (e) {
    return false;
  }
}

function setUpServerPrimary(config) {
  const worker = fork(join(__dirname, '..', 'index.js'), [
    process.argv,
    '--fork',
    JSON.stringify({ type: 'server', config }),
  ]);

  function kill() {
    return worker.kill();
  }

  function prepare(suiteName) {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'ready' && message.suite === suiteName) {
          worker.off('message', messageListener);
          worker.off('error', errorListener);
          resolve();
        }
      };
      const errorListener = (error) => {
        worker.off('message', messageListener);
        reject(error);
      };
      worker.on('message', messageListener);
      worker.once('error', errorListener);
      worker.send({ type: 'prepare', suite: suiteName });
    });
  }

  function cpu() {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'cpu') {
          worker.off('message', messageListener);
          worker.off('error', errorListener);
          resolve(message.cpu);
        }
      };
      const errorListener = (error) => {
        worker.off('message', messageListener);
        reject(error);
      };
      worker.on('message', messageListener);
      worker.once('error', errorListener);
      worker.send({ type: 'cpu' });
    });
  }

  return new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('message', () => resolve({ prepare, kill, cpu }));
  });
}

function setUpServerWorker(config) {
  const worker = cluster.fork({ SERVER_WORKER_CONFIG: JSON.stringify(config) });

  function kill() {
    return worker.terminate();
  }

  function prepare(suiteName) {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'ready' && message.suite === suiteName) {
          worker.off('message', messageListener);
          worker.off('error', errorListener);
          resolve();
        }
      };
      const errorListener = (error) => {
        worker.off('message', messageListener);
        reject(error);
      };
      worker.on('message', messageListener);
      worker.once('error', errorListener);
      worker.send({ type: 'prepare', suite: suiteName });
    });
  }

  function cpu() {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'cpu') {
          worker.off('message', messageListener);
          worker.off('error', errorListener);
          resolve(message.cpu);
        }
      };
      const errorListener = (error) => {
        worker.off('message', messageListener);
        reject(error);
      };
      worker.on('message', messageListener);
      worker.once('error', errorListener);
      worker.send({ type: 'cpu' });
    });
  }

  return new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('message', () => resolve({ prepare, kill, cpu }));
  });
}

function setUpClientWorker(config) {
  const worker = new Worker(join(__dirname, '..', 'index.js'), { workerData: { type: 'client', config } });

  function kill() {
    return worker.terminate();
  }

  function prepare(suiteName) {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'ready' && message.suite === suiteName) {
          worker.off('message', messageListener);
          worker.off('error', errorListener);
          resolve();
        }
      };
      const errorListener = (error) => {
        worker.off('message', messageListener);
        reject(error);
      };
      worker.on('message', messageListener);
      worker.once('error', errorListener);
      worker.postMessage({ type: 'prepare', suite: suiteName });
    });
  }

  function run(suiteName, benchmarkName) {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'finished' && message.suite === suiteName && message.benchmark === benchmarkName) {
          worker.off('message', messageListener);
          worker.off('error', errorListener);
          resolve(message.data);
        }
      };
      const errorListener = (error) => {
        worker.off('message', messageListener);
        reject(error);
      };
      worker.on('message', messageListener);
      worker.once('error', errorListener);
      worker.postMessage({ type: 'run', suite: suiteName, benchmark: benchmarkName });
    });
  }

  function warm(suiteName, benchmarkName) {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'warming-finished' && message.suite === suiteName && message.benchmark === benchmarkName) {
          worker.off('message', messageListener);
          worker.off('error', errorListener);
          resolve(message.data);
        }
      };
      const errorListener = (error) => {
        worker.off('message', messageListener);
        reject(error);
      };
      worker.on('message', messageListener);
      worker.once('error', errorListener);
      worker.postMessage({ type: 'warm', suite: suiteName, benchmark: benchmarkName });
    });
  }

  return new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('message', () => resolve({ prepare, run, kill, warm }));
  });
}

exports.setUpServerPrimary = setUpServerPrimary;
exports.setUpServerWorker = setUpServerWorker;
exports.setUpClientWorker = setUpClientWorker;
exports.setPriority = setPriority;

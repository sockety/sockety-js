const cluster = require('node:cluster');
const os = require('node:os');
const { join } = require('node:path');
const { Worker } = require('node:worker_threads');

function setPriority(priority) {
  try {
    os.setPriority(process.pid, priority);
    return true;
  } catch (e) {
    return false;
  }
}

function setUpServerPrimary(config) {
  const worker = new Worker(join(__dirname, '..', 'index.js'), { workerData: { type: 'server', config } });

  function kill() {
    return worker.terminate();
  }

  function prepare(suiteName) {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'ready' && message.suite === suiteName) {
          worker.off('message', messageListener);
          resolve();
        }
      };
      worker.on('message', messageListener);
      worker.once('error', (error) => {
        worker.off('message', messageListener);
        reject(error);
      });
      worker.postMessage({ type: 'prepare', suite: suiteName });
    });
  }

  return new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('message', () => resolve({ prepare, kill }));
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
          resolve();
        }
      };
      worker.on('message', messageListener);
      worker.once('error', (error) => {
        worker.off('message', messageListener);
        reject(error);
      });
      worker.send({ type: 'prepare', suite: suiteName });
    });
  }

  return new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('message', () => resolve({ prepare, kill }));
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
          resolve();
        }
      };
      worker.on('message', messageListener);
      worker.once('error', (error) => {
        worker.off('message', messageListener);
        reject(error);
      });
      worker.postMessage({ type: 'prepare', suite: suiteName });
    });
  }

  function run(suiteName, benchmarkName) {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'finished' && message.suite === suiteName && message.benchmark === benchmarkName) {
          worker.off('message', messageListener);
          resolve(message.data);
        }
      };
      worker.on('message', messageListener);
      worker.once('error', (error) => {
        worker.off('message', messageListener);
        reject(error);
      });
      worker.postMessage({ type: 'run', suite: suiteName, benchmark: benchmarkName });
    });
  }

  function warm(suiteName, benchmarkName) {
    return new Promise((resolve, reject) => {
      const messageListener = (message) => {
        if (message?.type === 'warming-finished' && message.suite === suiteName && message.benchmark === benchmarkName) {
          worker.off('message', messageListener);
          resolve(message.data);
        }
      };
      worker.on('message', messageListener);
      worker.once('error', (error) => {
        worker.off('message', messageListener);
        reject(error);
      });
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

const cluster = require('node:cluster');
const { isMainThread, parentPort, workerData } = require('node:worker_threads');
const { join } = require('node:path');
const { formatNumber } = require('@bestest/math');
const chalk = require('chalk');
const { program } = require('commander');
const getPort = require('get-port');
const glob = require('glob');
const parseDuration = require('parse-duration');
const { runBenchmark, aggregateBenchmarks, printHeader, printToast, printResult } = require('./src/benchmark');
const { getSuite, registeredSuites } = require('./src/declare');
const { setUpClientWorker, setUpServerWorker, setUpServerPrimary, setPriority } = require('./src/worker');

// Set up configuration

const defaultConfig = {
  serverWorkers: 1,
  clientWorkers: 2,
  connectionsPerWorker: 2,
  concurrencyPerWorker: 250,
  duration: 5000,
};
const config = JSON.parse(process.env.SERVER_WORKER_CONFIG || 'null') || workerData?.config || defaultConfig;

// Load benchmarks

for (const suiteFilePath of glob.sync(join(__dirname, 'src/suites/*.js'))) {
  require(suiteFilePath);
}

// Handle server

async function handleServerPrimary() {
  setPriority(-20);
  const workers = [];
  for (let i = 0; i < config.serverWorkers; i++) {
    workers.push(await setUpServerWorker(config));
  }
  parentPort.on('message', async (message) => {
    if (message?.type === 'prepare') {
      await Promise.all(workers.map((worker) => worker.prepare(message.suite)));
      parentPort.postMessage({ type: 'ready', suite: message.suite });
    }
  });
  parentPort.postMessage('started instance');
}

async function handleServerWorker() {
  setPriority(-20);
  process.on('message', async (message) => {
    if (message?.type === 'prepare') {
      const suite = getSuite(message.suite, config);
      await suite.serverSetup(suite.context);
      process.send({ type: 'ready', suite: message.suite });
    }
  });
  cluster.worker.send('started instance');
}

// Handle client

async function handleClientWorker() {
  setPriority(-20);
  parentPort.on('message', async (message) => {
    if (message?.type === 'prepare') {
      const suite = getSuite(message.suite, config);
      await suite.clientSetup(suite.context);
      parentPort.postMessage({ type: 'ready', suite: message.suite });
    } else if (message?.type === 'run') {
      const suite = getSuite(message.suite, config);
      const fn = suite.benchmarks.find((x) => x.name === message.benchmark)?.handler;
      if (!fn) {
        throw new Error(`"${message.benchmark}" is not registered in "${message.suite}" suite.`);
      }

      parentPort.postMessage({
        type: 'finished',
        suite: message.suite,
        benchmark: message.benchmark,
        data: await runBenchmark(fn, suite.context, {
          concurrency: config.concurrencyPerWorker,
          duration: config.duration,
        }),
      });
    }
  });
  parentPort.postMessage('started instance');
}

// Handle controller

async function runSuite(name) {
  const suite = getSuite(name);

  printHeader(name);

  for (const benchmark of suite.benchmarks) {
    printToast(benchmark.name, 'Starting server workers...');
    const server = await setUpServerPrimary(config);
    printToast(benchmark.name, 'Preparing server workers...');
    await server.prepare(suite.name);
    printToast(benchmark.name, 'Starting client workers...');
    const clients = await Promise.all(new Array(config.clientWorkers).fill(1).map(() => setUpClientWorker(config)));
    printToast(benchmark.name, 'Preparing client workers...');
    await Promise.all(clients.map((client) => client.prepare(suite.name)));

    const startTime = Date.now();
    const interval = setInterval(() => {
      const percentage = 100 * (Date.now() - startTime) / config.duration;
      const length = 66;
      const bar = '▓'.repeat(Math.min(percentage, 100) / (100 / length)).padEnd(length, '░');
      if (percentage > 100) {
        printToast(benchmark.name, 'Finishing...');
      } else {
        printToast(benchmark.name, `${bar} ${formatNumber(percentage, 2).padStart(6)}%`);
      }
    }, 50);

    try {
      const result = aggregateBenchmarks(await Promise.all(clients.map((client) => client.run(suite.name, benchmark.name))));
      clearInterval(interval);
      printResult(benchmark.name, result, config);
    } catch (error) {
      clearInterval(interval);
      throw error;
    }

    await Promise.all([ server.kill(), ...clients.map((client) => client.kill()) ]);
  }
}

async function handleController() {
  // Read arguments
  const options = program
    .option('-t, --time <ms>', 'Duration for each benchmark', `${defaultConfig.duration / 1000}s`)
    .option('-s, --servers <count>', 'Number of server workers', defaultConfig.serverWorkers)
    .option('-c, --clients <count>', 'Number of client workers', 'servers * 2')
    .option('-cc, --concurrency <count>', 'Concurrency for each client', defaultConfig.concurrencyPerWorker)
    .option('-cn, --connections <count>', 'Connections maintained for each client', defaultConfig.connectionsPerWorker)
    .option('-f, --filter [filter...]', 'Filter benchmarks to run')
    .option('-e, --exclude [exclude...]', 'Exclude benchmarks to run')
    .parse()
    .opts();

  // Apply them to configuration
  if (options.time) {
    config.duration = parseDuration(options.time);
    if (!config.duration) {
      throw new Error('Invalid --time passed');
    }
  }
  if (options.servers) {
    config.serverWorkers = parseInt(options.servers, 10);
    if (!config.serverWorkers) {
      throw new Error('Invalid --servers passed');
    }
    if (options.clients === 'servers * 2') {
      config.clientWorkers = config.serverWorkers * 2;
    }
  }
  if (options.clients !== 'servers * 2') {
    config.clientWorkers = parseInt(options.clients, 10);
    if (!config.clientWorkers) {
      throw new Error('Invalid --clients passed');
    }
  }
  if (options.concurrency) {
    config.concurrencyPerWorker = parseInt(options.concurrency, 10);
    if (!config.concurrencyPerWorker) {
      throw new Error('Invalid --concurrency passed');
    }
  }
  if (options.connections) {
    config.connectionsPerWorker = parseInt(options.connections, 10);
    if (!config.connectionsPerWorker) {
      throw new Error('Invalid --connections passed');
    }
  }

  // Filter benchmarks
  const filters = (options.filters || []).map((x) => x.toLowerCase().trim().split(/\s+/g));
  const exclude = (options.exclude || []).map((x) => x.toLowerCase().trim().split(/\s+/g));
  for (const suite of registeredSuites) {
    for (let index = 0; index < suite.benchmarks.length; index++) {
      const name = `${suite.name} ${suite.benchmarks[index].name}`.toLowerCase();

      // Ignore benchmark, when there are filters, and it's not matching them,
      // or when there are exclusions, and it's one of them
      if (
        (filters.length > 0 && !filters.some((rule) => !rule.some((phrase) => name.includes(phrase)))) ||
        (exclude.length > 0 && exclude.some((rule) => rule.every((phrase) => name.includes(phrase))))
      ) {
        suite.benchmarks.splice(index, 1);
        index--;
        continue;
      }
    }
  }

  // Delete suites without benchmarks
  for (let index = 0; index < registeredSuites.length; index++) {
    if (registeredSuites[index].benchmarks.length === 0) {
      registeredSuites.splice(index, 1);
      index--;
    }
  }

  // Find unused port for benchmarking
  config.port = await getPort();

  // Print configuration
  console.log(`${chalk.ansi256(30).bold('Server workers:')} ${config.serverWorkers}`);
  console.log(`${chalk.ansi256(30).bold('Client workers:')} ${config.clientWorkers}`);
  console.log(`${chalk.ansi256(30).bold('   Connections:')} ${config.clientWorkers} × ${config.connectionsPerWorker} (${config.clientWorkers * config.connectionsPerWorker})`);
  console.log(`${chalk.ansi256(30).bold('   Concurrency:')} ${config.clientWorkers} × ${config.concurrencyPerWorker} (${config.clientWorkers * config.concurrencyPerWorker})`);
  console.log(`${chalk.ansi256(30).bold('      Duration:')} ${formatNumber(config.duration)}ms`);

  // Check if it's possible to increase threads priority
  if (!setPriority(-15)) {
    process.stdout.write('Run as "root" to increase benchmark threads priority\n');
  }

  // Run all suites
  for (const suite of registeredSuites) {
    await runSuite(suite.name);
  }
}

// Decide what to run

const liftError = (fn) => Promise.resolve().then(fn).catch((error) => setTimeout(() => { throw error }));

if (cluster.worker) {
  liftError(handleServerWorker);
} else if (cluster.isPrimary && isMainThread) {
  liftError(handleController);
} else if (workerData?.type === 'server') {
  liftError(handleServerPrimary);
} else {
  liftError(handleClientWorker);
}

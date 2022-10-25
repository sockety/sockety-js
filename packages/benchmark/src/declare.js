// Helpers
const noop = () => {};

// State
const registeredSuites = [];
let currentSuite = null;

function registerSuite(name, fn) {
  currentSuite = {
    name,
    clientSetup: noop,
    serverSetup: noop,
    benchmarks: [],
    context: {},
  };
  fn();
  if (registeredSuites.some((x) => x.name === currentSuite.name)) {
    throw new Error(`"${currentSuite.name}" suite is already registered`);
  }
  if (currentSuite.benchmarks.length > 0) {
    registeredSuites.push(currentSuite);
  }
  currentSuite = null;
}

function registerClientSetup(fn) {
  const suite = currentSuite;
  const previousSetUp = currentSuite.clientSetup;
  currentSuite.clientSetup = () => Promise.resolve(previousSetUp(suite.context)).then(() => fn(suite.context));
}

function registerServerSetup(fn) {
  const suite = currentSuite;
  const previousSetUp = currentSuite.serverSetup;
  currentSuite.serverSetup = () => Promise.resolve(previousSetUp(suite.context)).then(() => fn(suite.context));
}

function registerBenchmark(name, fn) {
  currentSuite.benchmarks.push({ name, handler: fn });
}

function getSuite(name, config) {
  const suite = registeredSuites.find((suite) => suite.name === name);
  if (!suite) {
    throw new Error(`Suite "${name}" is not registered`);
  }
  suite.context.config = config;
  return suite;
}

exports.suite = registerSuite;
exports.prepareClient = registerClientSetup;
exports.prepareServer = registerServerSetup;
exports.benchmark = registerBenchmark;
exports.getSuite = getSuite;

exports.registeredSuites = registeredSuites;

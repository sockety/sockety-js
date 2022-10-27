const chalk = require('chalk');
const { formatNumber } = require('@bestest/math');

const hrtime = process.hrtime;
function getCurrentTime() {
  const [ seconds, nanoseconds ] = hrtime();
  return seconds * 1e12 + nanoseconds * 1e3;
}

const scheduleTask = new Function('tick', 'immediate', `
  var counter = 0;
  return function (fn) {
    if (counter++ % ${process.maxTickDepth / 2 || 500} !== 0) {
      tick(fn)
    } else {
      immediate(fn)
    }
  }
`)(process.nextTick, setImmediate);

async function runBenchmark(asyncFn, context, { concurrency, duration }) {
  return new Promise((resolve) => {
    function runTest() {
      // Initialize result arrays
      let successfulCount = 0;
      let failedCount = 0;
      let min = Infinity;
      let max = -Infinity;

      // Set-up variables variables required for runtime
      let runningTasks = 0;
      let finished = false;
      let currentTime = getCurrentTime();

      // Set-up helper functions

      function runExecutions() {
        for (let i = runningTasks; i < concurrency; i++) {
          spawnNextTask();
        }
      }

      function spawnNextTask() {
        currentTime = getCurrentTime();
        runningTasks++;
        spawnTask(currentTime);
      }

      function spawnTask(taskStartTime) {
        try {
          asyncFn(context).then(
            () => finishTask(taskStartTime),
            () => failTask(taskStartTime),
          );
        } catch (error) {
          failTask(taskStartTime);
        }
      }

      function finishTask(taskStartTime) {
        currentTime = getCurrentTime();
        runningTasks--;
        successfulCount++;
        min = Math.min(min, currentTime - taskStartTime);
        max = Math.max(max, currentTime - taskStartTime);
      }

      function failTask() {
        currentTime = getCurrentTime();
        runningTasks--;
        failedCount++;
      }

      function tick() {
        currentTime = getCurrentTime();
        finished = finished || (currentTime >= expectedEndTime);

        if (finished) {
          return end();
        }

        if (runningTasks < concurrency) {
          runExecutions();
        }

        scheduleTask(tick);
      }

      function end() {
        if (runningTasks > 0) {
          scheduleTask(tick);
          return;
        }

        const took = currentTime - startTime;
        const qps = successfulCount / (took / 1e12);

        resolve({
          concurrency,
          took,
          qps,
          min: min / 1e12,
          max: max / 1e12,
          avg: 1 / (qps / concurrency),
          successful: successfulCount,
          errors: failedCount,
        });
      }

      // Scan HR time at execution start
      const startTime = getCurrentTime();

      // Estimate test end
      const expectedEndTime = startTime + duration * 1e9;

      // Run tasks
      runExecutions();
      scheduleTask(tick);
    }

    runTest();
  });
}

function aggregateBenchmarks(results) {
  const qps = results.reduce((acc, x) => acc + x.qps, 0);
  const successful = results.reduce((acc, x) => acc + x.successful, 0);
  const errors = results.reduce((acc, x) => acc + x.errors, 0);
  const avg = results.length / qps * results[0].concurrency;
  const min = results.reduce((acc, x) => Math.min(acc, x.min), Infinity);
  const max = results.reduce((acc, x) => Math.max(acc, x.max), -Infinity);
  return {
    qps,
    successful,
    success: successful / (successful + errors),
    min,
    avg,
    max,
    errors,
  };
}

function printHeader(name) {
  process.stdout.write(
    '\n' + chalk.bgAnsi256(30)(' ' +
      chalk.bold(name.padEnd(30)) + chalk.black(
        'success'.padStart(14) +
        'QPS'.padStart(14) +
        'QPS/server'.padStart(14) +
        'min'.padStart(13) +
        'avg'.padStart(13) +
        'max'.padStart(13) +
        chalk.ansi256(30).bgAnsi256(30)('.')
      )) + '\n'
  );
}

function printResult(name, result, config) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  const success = `${formatNumber(result.success * 100, 2)}%`;
  const qps = formatNumber(result.qps);
  const qpss = formatNumber(result.qps / config.serverWorkers);
  const avg = `${formatNumber(result.avg * 1e3, 2)}ms`;
  const min = `${formatNumber(result.min * 1e3, 2)}ms`;
  const max = `${formatNumber(result.max * 1e3, 2)}ms`;
  const state = result.errors === 0 ? chalk.green : result.success > 0.9 ? chalk.yellow : chalk.red;
  process.stdout.write(` ${chalk.bold(name.padEnd(37))}${state(success.padStart(7))}${chalk.bold(qps.padStart(14))}${chalk.bold(qpss.padStart(14))}${min.padStart(13)}${avg.padStart(13)}${max.padStart(13)}\n`.padEnd(60, ' '));
  if (result.errors) {
    process.stdout.write(chalk.red.bold(`  Failed ${result.errors} times`) + '\n');
  }
}

function printToast(name, content) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(chalk.yellow(` ${chalk.bold(name.padEnd(37))}${content}`));
}

function printProgress(name, description, progress) {
  const percentage = Math.max(100 * progress);
  const formattedDescription = description.trim() === '' ? '' : `${description.trim()}  `;
  const length = 65 - formattedDescription.length;
  const bar = '▓'.repeat(Math.min(percentage, 100) / (100 / length)).padEnd(length, '░');
  if (percentage > 100) {
    printToast(name, `${formattedDescription}${bar} ~100.00%`);
  } else {
    printToast(name, `${formattedDescription}${bar}  ${formatNumber(percentage, 2).padStart(6)}%`);
  }
}

exports.runBenchmark = runBenchmark;
exports.aggregateBenchmarks = aggregateBenchmarks;
exports.printHeader = printHeader;
exports.printResult = printResult;
exports.printToast = printToast;
exports.printProgress = printProgress;

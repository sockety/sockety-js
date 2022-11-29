const { Readable } = require('node:stream');
const { ServiceBroker } = require('moleculer');
const { suite, benchmark, prepareClient, prepareServer } = require('../declare');
const { kb64, mb1 } = require('../../files');
const { makePool } = require('../makePool');

function common() {
  benchmark('No response', ({ getClient }) => getClient().call('benchmark.ping'));

  benchmark('Short response (code)', async ({ getClient }) => getClient().call('benchmark.fast'));

  benchmark('Regular response', async ({ getClient }) => getClient().call('benchmark.echo'));

  benchmark('64KB data (memory)', async ({ getClient }) => getClient().call('benchmark.ping', Readable.from(kb64.content)));

  // Too slow
  // benchmark('1MB data (memory)', async ({ getClient }) => getClient().call('benchmark.ping', Readable.from(mb1.content)));

  benchmark('64KB data (FS)', async ({ getClient }) => getClient().call('benchmark.ping', kb64.stream()));

  // Too slow
  // benchmark('1MB data (FS)', async ({ getClient }) => getClient().call('benchmark.ping', mb1.stream()));
}

suite('Moleculer', () => {
  prepareServer(async (context) => {
    const { serverIndex, port } = context.config;
    const broker = new ServiceBroker({
      nodeID: `server-${serverIndex}`,
      logger: false,
      metrics: false,
      tracing: false,
      requestTimeout: 120000,
      transporter: {
        type: 'TCP',
        options: {
          port,
          udpPeriod: 0.5,
          gossipPeriod: 0.5,
          maxConnections: Infinity,
          maxPacketSize: 64 * 1024 * 1024,
        },
      },
    });

    broker.createService({
      name: 'benchmark',
      actions: {
        ping() {
        },
        echo() {
          return {};
        },
        fast() {
          return 10;
        },
      },
    });

    await broker.start();
    return broker;
  });

  prepareClient(async (context) => {
    const { connectionsPerWorker } = context.config;

    context.getClient = await makePool(connectionsPerWorker, async () => {
      const broker = new ServiceBroker({
        nodeID: `client-${Math.random()}`,
        logger: false,
        metrics: false,
        tracing: false,
        requestTimeout: 120000,
        transporter: {
          type: 'TCP',
          options: {
            udpPeriod: 0.5,
            gossipPeriod: 0.5,
            maxConnections: Infinity,
            maxPacketSize: 64 * 1024 * 1024,
          },
        },
      });

      await broker.start();
      await broker.waitForServices('benchmark', 1000);
      return broker;
    });
  });

  common();
});

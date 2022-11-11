import { Connection, createMessageHandler, createServer, Draft, ContentProducer } from 'sockety';

// Build server

const server = createServer();

// Prepare calls

const systemMessage = Draft.for('system')
  .msgpack<{ date: string, content: string }>()
  .createFactory();

const usersStatus = Draft.for('users')
  .msgpack<string[]>()
  .createFactory();

const passBroadcast = Draft.for('receiveBroadcast')
  .msgpack<{ date: string, author: string, content: string }>()
  .createFactory();

// Prepare context storage

const names: WeakMap<Connection, string> = new WeakMap();

// Prepare helpers

const getConnections = () => server.clients.filter((x) => names.has(x));
const getConnectionsExcept = (connection: Connection) => getConnections().filter((x) => x !== connection);
const send = (connections: Connection[], message: ContentProducer) => Promise.all(connections.map((x) => x.pass(message)));

// Prepare logic

// TODO: Consider sending error messages
const handler = createMessageHandler({
  async name(message) {
    if (message.dataSize === 0 || message.dataSize > 51) {
      return message.reject();
    }
    const name = await message.msgpack();
    if (typeof name !== 'string') {
      return message.reject();
    }
    const prevName = names.get(message.connection);
    names.set(message.connection, name);

    // Send system message about new connection
    {
      const date = new Date().toISOString();
      const content = prevName ? `${prevName}: has renamed to "${name}".` : `${name}: connected.`;
      const preparedMessage = systemMessage({ data: { date, content } });
      await send(getConnectionsExcept(message.connection), preparedMessage);
    }

    // Send list of all users
    {
      const preparedMessage = usersStatus({ data: getConnections().map((x) => names.get(x)!) });
      await send(getConnections(), preparedMessage);
    }
  },

  async broadcast(message) {
    const name = names.get(message.connection);
    if (!name) {
      return message.reject();
    }
    const text = await message.msgpack();
    if (typeof text !== 'string') {
      return message.reject();
    }
    const date = new Date().toISOString();
    const content = { date, author: name, content: text };
    const preparedMessage = passBroadcast({ data: content });
    await send(getConnections(), preparedMessage);
  },
});

server.on('connection', (connection) => {
  connection.on('message', handler);
  connection.on('error', (error) => {
    // TODO: Use UUIDs instead, as indexes are not stable
    process.stderr.write(`#${server.clients.indexOf(connection)}: ${error.message}\n`);
  })
  connection.on('close', async () => {
    const name = names.get(connection);
    if (!name) {
      return;
    }

    {
      const preparedMessage = systemMessage({
        data: { date: new Date().toISOString(), content: `${name}: disconnected.` },
      });
      await send(getConnections(), preparedMessage);
    }

    {
      const preparedMessage = usersStatus({
        data: getConnections().map((x) => names.get(x)!),
      });
      await send(getConnections(), preparedMessage);
    }
  });
});

// Start server

server.listen(9000).then(
  () => process.stdout.write(`Server started at port 9000\n`),
  (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  },
);

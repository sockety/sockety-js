import { Connection, createMessageHandler, createServer, Draft } from 'sockety';
import { series } from '@sockety/core/src/producers/series';

// Build server

const server = createServer();

// Prepare structure

const systemMessage = Draft.for('system')
  .msgpack<{ date: string, content: string }>()
  .createFactory();

const usersStatus = Draft.for('users')
  .msgpack<string[]>()
  .createFactory();

const userMessage = Draft.for('main')
  .msgpack<{ date: string, author: string, content: string }>()
  .createFactory();

// Prepare templates

const system = (content: string) => systemMessage({ data: { date: now(), content } });
const user = (author: string, content: string) => userMessage({ data: { date: now(), author, content } });
const userList = () => usersStatus({ data: getNames() });

// Prepare context storage

const names: WeakMap<Connection, string> = new WeakMap();

// Prepare helpers

const now = () => new Date().toISOString();
const except = <T>(x: T) => (y: T) => x !== y;
const registered = (x: Connection) => names.has(x);
const both = (...fns: ((x: Connection) => boolean)[]) => (x: Connection) => fns.every((fn) => fn(x));
const getConnections = () => server.clients.filter(registered);
const getNames = () => getConnections().map((x) => names.get(x)!);

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

    // Send system message about current state
    const content = prevName ? `${prevName}: has renamed to "${name}".` : `${name}: connected.`;
    await server.broadcast(system(content), both(registered, except(message.connection)));

    // Send list of all users
    await server.broadcast(userList(), registered);
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
    await server.broadcast(user(name, text), registered);
  },
});

server.on('connection', (connection) => {
  connection.on('message', handler);
  connection.on('error', (error) => {
    // TODO: Use UUIDs instead, as indexes are not stable
    process.stderr.write(`#${server.clients.indexOf(connection)}: ${error.message}\n`);
  });
  connection.on('close', async () => {
    const name = names.get(connection);
    if (!name) {
      return;
    }

    await server.broadcast(series(system(`${name}: disconnected.`), userList()), registered);
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

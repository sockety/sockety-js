import { Connection, createServer, Draft, MessageHandler, ActionHandler, FastReply, series } from 'sockety';

// Build server

const server = createServer();

// Prepare structure

const systemMessage = Draft.for('system')
  .msgpack<{ date: string, content: string }>()
  .createFactory();

const usersStatus = Draft.for('users')
  .msgpack<string[]>()
  .createFactory();

const chatMessage = Draft.for('chat')
  .msgpack<{ date: string, author: string, content: string }>()
  .createFactory();

const loginMessage = Draft.for('login')
  .msgpack<string>()
  .createFactory();

// Prepare message templates

const system = (content: string) => systemMessage({ data: { date: now(), content } });
const chat = (author: string, content: string) => chatMessage({ data: { date: now(), author, content } });
const userList = (data: string[]) => usersStatus({ data });
const login = (name: string) => loginMessage({ data: name });

// Prepare context storage

const names: WeakMap<Connection, string> = new WeakMap();

// Prepare helpers

const now = () => new Date().toISOString();
const except = <T>(x: T) => (y: T) => (x !== y);
const getName = (connection: Connection) => names.get(connection)!;
const getNames = () => server.clients.map(getName);
const isNameValid = (name: unknown) => (typeof name === 'string' && /^[a-zA-Z0-9_-]{3,50}$/.test(name));
const isChatValid = (content: unknown) => (typeof content === 'string' && content.trim().length > 0 && !/[\n\r]/.test(content) && !/\\x[19]b/i.test(content));
const randomString = () => Math.ceil(Math.random() * 1e10).toString(32);

// Prepare logic

const onNameChange = ActionHandler.create()
  .run(async (message) => {
    // Avoid unnecessary files transfer
    if (message.filesCount > 0) {
      return FastReply.BadRequest;
    }

    // Avoid unsupported stream
    if (message.stream) {
      return FastReply.BadRequest;
    }

    // Get and validate data
    const name = await message.msgpack();
    if (!isNameValid(name)) {
      return FastReply.BadRequest;
    }

    // Disallow duplicated name
    if (server.clients.some((connection) => getName(connection) === name)) {
      return FastReply.BadRequest;
    }

    // Update name
    const prevName = getName(message.connection);
    names.set(message.connection, name);

    // Inform members about update
    await server.broadcast(system(`${prevName}: has renamed to "${name}"`), except(message.connection));
    await server.broadcast(userList(getNames()));

    return FastReply.Accept;
  });

const onChatMessage = ActionHandler.create()
  .run(async (message) => {
    // Avoid unnecessary files transfer
    if (message.filesCount > 0) {
      return FastReply.BadRequest;
    }

    // Avoid unsupported stream
    if (message.stream) {
      return FastReply.BadRequest;
    }

    // Get and validate data
    const content = await message.msgpack();
    if (!isChatValid(content)) {
      return FastReply.BadRequest;
    }

    // Inform members about the message
    await server.broadcast(chat(getName(message.connection), content));

    return FastReply.Accept;
  });

// Build handler (TODO: and optimize for better performance)
// TODO: Consider sending error messages
const handler = MessageHandler.create({ autoAck: true })
  .on('name', onNameChange)
  .on('broadcast', onChatMessage);

server.on('connection', async (connection) => {
  // Apply message handler
  connection.on('message', handler);

  // Show connection errors in console
  connection.on('error', (error) => {
    // TODO: Use UUIDs instead, as indexes are not stable
    process.stderr.write(`#${server.clients.indexOf(connection)}: ${error.message}\n`);
  });

  // Inform about disconnected user
  connection.on('close', async () => {
    const name = getName(connection);
    await server.broadcast(series(system(`${name}: disconnected.`), userList(getNames())));
  });

  // Set up random name for anonymous user, and inform everybody
  const name = `anon_${randomString()}`;
  names.set(connection, name);
  await Promise.all([
    connection.pass(series(login(name), userList(getNames()))),
    server.broadcast(system(`${name}: connected`), except(connection)),
  ]);
});

// Start server

server.listen(9000).then(
  () => process.stdout.write(`Server started at port 9000\n`),
  (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  },
);

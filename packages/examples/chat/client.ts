import * as readline from 'node:readline';
import * as chalk from 'chalk';
import { connect, createMessageHandler, Draft } from 'sockety';

// Configuration

const port = 9000;

// Set up interface

let usersList: string[] = [];
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
  completer: (line: string) => {
    const match = line.match(/@([^@]*)$/);
    if (!match) {
      return [ line ];
    }
    const beginning = line.substring(0, line.length - match[1].length);
    const matchingUsers = usersList.filter((x) => x.startsWith(match[1]));
    return [matchingUsers.map((x) => `${beginning}${x}`), line];
  },
});

function writeLine(line: string): void {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`${line}\n`);
  rl.prompt(true);
}

const writeChatLine = (line: string) => writeLine(line);
const writeError = (line: string) => writeLine(chalk.red(line));

// Set draft messages

const register = Draft.for('name')
  .msgpack<string>()
  .createFactory();

const broadcast = Draft.for('broadcast')
  .msgpack<string>()
  .createFactory();

// Set up logic

// TODO: Handle disconnect
async function start(name: string) {
  const client = connect(port);

  client.on('close', () => {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(chalk.red('Connection with server closed.\n'));
    process.exit(0);
  });

  client.on('message', createMessageHandler({
    async main(message) {
      const { date, author, content } = await message.msgpack();
      const time = date.match(/\d{2}:\d{2}:\d{2}/)[0];
      const formattedContent = content
        .replace(/@[a-zA-Z\d_-]+/g, (x: string) => (
          x === `@${name}`
            ? chalk.bold.green(x)
            : chalk.bold(x)
        ))
      writeChatLine(`${chalk.bold(`${chalk.gray(time)} ${author === name ? chalk.green(author + ':') : author + ':'}`)} ${formattedContent}`);
    },

    async system(message) {
      const { date, content } = await message.msgpack();
      const time = date.match(/\d{2}:\d{2}:\d{2}/)[0];
      writeChatLine(`${chalk.bold(`${chalk.gray(time)}`)} ${chalk.italic.cyan(content)}`);
    },

    async users(message) {
      usersList = await message.msgpack();
    },
  }));

  await client.ready();
  await client.pass(register({ data: name }));

  function readMessage() {
    rl.question('> ', async (text) => {
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
      if (text.trim().length === 0) {
        return process.nextTick(readMessage);
      }

      readMessage();

      const [ , command, arg ] = text.match(/^\/(name)\s+(.+)$/) || [];
      if (command === 'name') {
        name = arg;
        await client.send(register({ data: arg })).sent();
      } else {
        await client.send(broadcast({ data: text })).sent();
      }
    });
  }

  readMessage();
}

// Obtain name

// TODO: Require unique names
// TODO: Disallow spaces, commas, dots in name - only alphanumeric and _-
rl.question(chalk.bold('Your name: '), (name) => {
  if (name.length === 0 || name.length > 50) {
    throw new Error('Name should be between 1 and 50 characters.');
  }

  start(name).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
});

import * as readline from 'node:readline';
import * as chalk from 'chalk';
import { connect, Draft, FastReply, Message, MessageHandler } from 'sockety';

// Configuration

const port = 9000;

// Prepare structure

const registerMessage = Draft.for('name').msgpack<string>();
const broadcastMessage = Draft.for('broadcast').msgpack<string>();

// Prepare message templates

const register = (name: string) => registerMessage({ data: name });
const broadcast = (content: string) => broadcastMessage({ data: content });

// Set up helpers

const now = () => new Date().toISOString();
const getPrompt = (name: string) => `${chalk.gray(name)}> `;
const extractTime = (isoDate: string) => isoDate.match(/\d{2}:\d{2}:\d{2}/)![0];
const formatTime = (isoDate: string) => chalk.bold.gray(extractTime(isoDate));
const formatSystem = (content: string) => chalk.italic.cyan(content);
const formatMention = (mention: string) => chalk.bold(mention);
const formatOwnMention = (mention: string) => chalk.bold.green(mention);
const formatAuthor = (name: string, currentUser: string) => (name === currentUser ? formatOwnMention(`${name}:`) : formatMention(`${name}:`));
const formatMessage = (content: string, users: string[], currentUser: string) => content
  .replace(/(?:^|\s+)@([a-zA-Z0-9_-]{3,50})(?:\s+|$)/g, (mention, name) => {
    if (name === currentUser) {
      return formatOwnMention(mention);
    } else if (users.includes(name)) {
      return formatMention(mention);
    } else {
      return mention;
    }
  });

// Prepare context storage

let usersList: string[] = [];

// Set up interface

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  completer: (line: string) => {
    const match = line.match(/@([^@]*)$/);
    if (!match) {
      return [ line ];
    }
    const beginning = line.substring(0, line.length - match[1].length);
    const matchingUsers = usersList.filter((x) => x.startsWith(match[1]));
    return [
      matchingUsers.map((x) => `${beginning}${x}`),
      line,
    ];
  },
});

function clearLine(): void {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
}

function writeLine(line: string): void {
  clearLine();
  process.stdout.write(`${line}\n`);
  rl.prompt(true);
}

function redrawLine(): void {
  clearLine();
  rl.prompt(true);
}

const writeChat = (line: string) => writeLine(line);
const writeError = (line: string) => writeLine(chalk.red(line));

// Set up logic

async function start() {
  let name: string = '';
  let logInFinished!: () => void;
  const loggedIn = new Promise<void>((resolve) => {
    logInFinished = resolve;
  });

  const client = connect(port);

  const onChatMessage = async (message: Message) => {
    // Read a message
    const { date, author, content } = await message.msgpack();

    // Write the message on the screen
    writeChat(`${formatTime(date)} ${formatAuthor(author, name)} ${formatMessage(content, usersList, name)}`);
  };

  const onSystemMessage = async (message: Message) => {
    // Read a message
    const { date, content } = await message.msgpack();

    // Write the message on the screen
    writeChat(`${formatTime(date)} ${formatSystem(content)}`);
  };

  const onUsersList = async (message: Message) => {
    // Load users list for terminal mention auto-complete
    usersList = await message.msgpack();
  };

  const onLogin = async (message: Message) => {
    // Save information about login
    name = await message.msgpack();
    logInFinished();
  };

  // Build handler
  const handler = new MessageHandler()
    .action('login', onLogin)
    .action('chat', onChatMessage)
    .action('system', onSystemMessage)
    .action('users', onUsersList)
    .error(() => FastReply.InternalError);

  // Set up connection
  client.on('message', handler);
  client.on('close', () => {
    writeError('Connection with server closed');
    process.exit(0);
  });

  function readMessage() {
    rl.question(getPrompt(name), async (text) => {
      // Clear written message
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);

      // Start new message reader
      readMessage();

      // Ignore when the message was empty
      if (text.trim().length === 0) {
        return;
      }

      // Verify if the message is not a known command
      // /name ThereIsNewName
      const [ , command, arg ] = text.match(/^\/(name|users|help)(?:\s+(.+))?$/) || [];
      if (command === 'name' && arg) {
        // Request new name (TODO: Handle errors)
        name = arg;
        await client.send(register(name)).sent();
        rl.setPrompt(getPrompt(name));
        redrawLine();
      } else if (command === 'users') {
        writeChat(`${formatTime(now())} ${formatSystem(`${chalk.bold('/users:')} ${usersList.join(' ')}`)}`);
      } else if (command === 'help') {
        writeChat(`${formatTime(now())} ${formatSystem(chalk.bold('Commands:'))}`);
        writeChat(`         ${formatSystem(`${chalk.bold('/users:          ')} get list of users`)}`);
        writeChat(`         ${formatSystem(`${chalk.bold('/name <new_name>:')} update own name`)}`);
        writeChat(`         ${formatSystem(`${chalk.bold('/help:           ')} this help`)}`);
      } else {
        // Send chat message (TODO: Handle errors)
        await client.send(broadcast(text)).sent();
      }
    });
  }

  // Register & start chat
  await client.ready();
  await loggedIn;
  readMessage();
}

// Start application

process.stdout.write(chalk.gray(`Type ${chalk.bold('/help')} for available commands.\n`));

start().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

// These lines make "require" available
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { token } = require('./config.json');
const { debug } = require('console');
const logModule = require('./logModule');
const rollModule = require('./rollModule');

const { Client, Intents } = require('discord.js');

//const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const client = new Client({ intents: ['DIRECT_MESSAGES', 'DIRECT_MESSAGE_REACTIONS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILDS'] });

process.on('uncaughtException', function (err) {
	console.log('Caught exception: ' + err);
});

function debugMessage(str) {
	console.log(str);
}

client.once('ready', () => {
	debugMessage('Ready!');
	debugMessage('Waiting for input...');
});
client.login(token);

function send(channel, msg) {
	if (msg == -1) {
		debugMessage("Error: Invalid message");
		return;
	}
	debugMessage("Send:\n" + msg + '\n');
	channel.send(msg);
}

async function getNickname(user, guild, callback) {
	var member = await guild.members.fetch(user);
	callback(member ? member.displayName : user.username);
}

client.on('messageCreate', function (message) {
	var content = message.content;
	var channel = message.channel;
	if (content.substring(0, 1) == '!') { // Commands start with '!'
		var args = content.substring(1).split(' ');
		debugMessage(args[0]);
		switch (args[0]) {
			case 'roll':
				var num1 = 100, num2 = 1;

				var roll = -1;
				if (args.length > 1) {
					num1 = Number(args[1]);
				}
				if (args.length > 2) {
					num2 = Number(args[2]);
				}

				roll = (num1 >= num2 ? rollModule.roll(num1, num2) : rollModule.roll(num2, num1));
				if (roll == -1) {
					break;
				}

				getNickname(message.author, message.guild, function (msg) {
					msg += ' rolls ' + roll;
					send(channel, msg);
				});
				break;
			case 'coin':
				send(channel, rollModule.roll(0, 1) == 1 ? "Heads" : "Tails");
				break;
			case 'log':
				if (args.length == 2) { // Specific ID
					logModule.getLogMessage(args[1]);
				}
				else { // Most recent
					logModule.getLogMessage();
				}
				break;
			default:
				var str = "Commands:\n";
				str += "!roll\n";
				str += "!coin\n";
				str += "!log\n";
				send(channel, str);
				break;
		}
	}
});
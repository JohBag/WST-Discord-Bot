const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Dynamically retrieve event files
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// Dynamically retrieve command files
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

client.login(token);

function send(channel, msg) {
	if (msg == -1) {
		console.log("Error: Invalid message");
		return;
	}
	console.log("Send:\n" + msg + '\n');
	channel.send(msg);
}

async function getNickname(user, guild, callback) {
	var member = await guild.members.fetch(user);
	callback(member ? member.displayName : user.username);
}
/*
client.on('messageCreate', async function (message) {
	var content = message.content;
	var channel = message.channel;
	if (content.substring(0, 1) == '!') { // Commands start with '!'
		var args = content.substring(1).split(' ');
		console.log(args[0]);

		var msg = "";
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
				});
				break;
			case 'coin':
				msg = rollModule.roll(0, 1) == 1 ? "Heads" : "Tails";
				break;
			case 'log':
				var id = 0;
				if (args.length == 2) { // Specific ID
					id = args[1];
				}
				msg = await logModule.getLogMessage(id);
				break;
			default:
				break;
		}
		console.log(msg);
		if (msg != "") {
			send(channel, msg);
		}
	}
});
*/
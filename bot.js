var Discord = require('discord.io');
var auth = require('./auth.json');
const { debug } = require('console');
const logTool = require('./logTool');

process.on('uncaughtException', function (err) {
	console.log('Caught exception: ' + err);
});

// Initialize Discord Bot
var bot = new Discord.Client({
	token: auth.token,
	autorun: true
});

function debugMessage(str) {
	console.log(str);
}

bot.on('ready', function (evt) {
	debugMessage('Connected');
	debugMessage(bot.username + ' - (' + bot.id + ')');

	logTool.fetchMostRecent(function (msg) {
		debugMessage(msg);
	});
});

function send(chID, msg) {
	debugMessage("Send:\n" + msg);
	bot.sendMessage({
		to: chID,
		message: msg
	});
}

function random(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

bot.on('message', function (user, userID, channelID, message, evt) {
	// Our bot needs to know if it will execute a command
	// It will listen for messages that will start with `!`

	if (message.substring(0, 1) == '!') {
		var args = message.substring(1).split(' ');
		var cmd = args[0];

		// Commands
		switch (cmd) {
			case 'help':
			case 'commands':
				var str = "Commands:\n";
				str += "1. help/commands\n";
				send(channelID, str);
				break;
			case 'roll':
				var max = 100;
				if (args.length > 1) {
					var n = parseInt(args[1]);
					if (Number.isInteger(n)) {
						max = n;
					}
				}
				send(channelID, random(1, max));
				break;
			case 'coin':
				send(channelID, random(0, 1) == 1 ? "Heads" : "Tails");
				break;
			case 'log':
				if (args.length == 2) { // Specific ID
					logTool.getLogMessage(args[1], function (msg) {
						send(channelID, msg);
					});
				}
				else { // Most recent
					logTool.fetchMostRecent(function (msg) {
						send(channelID, msg);
					});
				}
				break;
		}
	}
});
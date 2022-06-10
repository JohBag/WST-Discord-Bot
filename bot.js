var Discord = require('discord.io');
var auth = require('./auth.json');
const { debug } = require('console');
const logTool = require('./logTool');
const rollModule = require('./rollModule');

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
	debugMessage('Ready for input');
	/*
	logTool.fetchMostRecent(function (msg) {
		debugMessage(msg);
	});
	*/
	/*
		logTool.getLogMessage("---", function (msg) {
			debugMessage(msg);
		});
		*/
});

function send(chID, msg) {
	if (msg == -1) {
		debugMessage("Error: Invalid message");
		return;
	}
	debugMessage("Send:\n" + msg);
	bot.sendMessage({
		to: chID,
		message: msg
	});
}

bot.on('message', function (user, userID, channelID, message, evt) {
	// The bot listens to commands that starts with '!'
	if (message.substring(0, 1) == '!') {
		// Commands
		var args = message.substring(1).split(' ');
		switch (args[0]) {
			case 'help':
				var str = "Commands:\n";
				str += "1) help - Show commands\n";
				str += "2) roll (max optional) - Rolls a number between 1-100\n";
				str += "3) coin - Flips a coin\n";
				str += "4) log (id optional) - Returns the most recent log data from warcraftlogs\n";
				send(channelID, str);
				break;
			case 'roll':
				send(channelID, rollModule.roll(100));
				break;
			case 'coin':
				send(channelID, rollModule.roll(0, 1) == 1 ? "Heads" : "Tails");
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
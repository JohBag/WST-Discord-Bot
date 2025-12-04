# Warseeker Bot

This bot was developed for the World of Warcraft guild 'Warseeker Tribe', but is freely available to anyone who may be interested.

## Installation

### Secrets

Add a new file named 'secrets.json' to the json folder and replace the values with your own.

```
{
	"discord": {
		"clientId": DISCORD_CLIENT_ID,
		"token": DISCORD_BOT_TOKEN
	},
	"keys": {
		"gemini": GEMINI_API_KEY,
		"warcraftLogs": WARCRAFT_LOGS_API_KEY
	}
}
```

### Install Modules

    npm install

### Deploy Commands

New commands must be deployed before they can be used.

    node deploy-commands.js

If you change any of the commands, you will need to deploy them again. Make sure to delete the old commands first.

    node delete-commands.js
    node deploy-commands.js

### Start

    node bot.js
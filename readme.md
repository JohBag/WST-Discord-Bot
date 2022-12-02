## Warning

This bot is not intended for public use. All keys must be kept secret and can not shared or uploaded online without explicit permission.

## Installation

### Enter Keys

Create a folder called 'json' to the main folder, and add a new file named 'config.json'. The config file should have the following variables. Keys are provided upon request from the bot developer (Elethia).

    {
        "token": "TOKEN_HERE",
        "clientId": "CLIENT_ID_HERE",
        "guildId": "GUILD_ID_HERE",
        "apiKey": "API_KEY_HERE",
        "speechKey": "SPEECH_KEY_HERE",
        "speechRegion": "REGION_HERE",
        "warcraftlogsToken": "WCL_TOKEN_HERE"
    }

* Token - Bot token. 
* ClientID - Discord client ID.
* GuildID - Discord server ID.
* apiKey - Azure API key.
* SpeechKey - Azure speech resource key.
* SpeechRegion - Azure speech resource region.
* WarcraftLogsToken - WarcraftLogs client token.

### Install Prerequisites

    npm install discord.js
    npm install openai
    npm install microsoft-cognitiveservices-speech-sdk

### Deploy Commands

The commands may been to be redeployed if changes are made to the code or the guildID. This can be done by running deploy-commands.js once.

    node deploy-commands.js

### Starting the Bot

The bot can be run through a terminal. Powershell is recommended for Windows.

    node bot.js

### Important

By default, all commands will be available to everyone. This may not be ideal, and limitations can be made by the server admin to prevent misuse.
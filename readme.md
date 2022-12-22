## Installation

### Enter Keys

Create a new folder called 'json' to the main folder, then add a new file named 'secrets.json' to the json folder. The secrets file should have the following variables.

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
* apiKey - OpenAI API key.
* SpeechKey - Azure speech resource key.
* SpeechRegion - Azure speech resource region.
* WarcraftLogsToken - WarcraftLogs client token.

### Install Prerequisites

    npm install

or

    npm install discord.js
    npm install openai
    npm install microsoft-cognitiveservices-speech-sdk

### Deploy Commands

The commands may need to be redeployed if changes are made to the code or the guildID. This can be done by running deploy-commands.js once.

    node deploy-commands.js

### Starting the Bot

    node bot.js

### Important

By default, all commands will be available to everyone. This may not be ideal, and limitations can be made by the server admin to prevent misuse.
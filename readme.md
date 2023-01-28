## Installation

### Secrets

Create a new folder called 'json' in the main folder if it does not already exist. Add a new file named 'secrets.json' with the following variables.

    {
        "token": "TOKEN_HERE",
        "clientId": "CLIENT_ID_HERE",
        "apiKey": "API_KEY_HERE",
        "speechKey": "SPEECH_KEY_HERE",
        "speechRegion": "REGION_HERE",
        "warcraftlogsToken": "WCL_TOKEN_HERE"
    }

* Token - Discord bot token. 
* ClientID - Discord bot client ID.
* apiKey - OpenAI API key.
* SpeechKey - Azure speech resource key.
* SpeechRegion - Azure speech resource region.
* WarcraftLogsToken - WarcraftLogs client token.

### Config

The json folder should also have a config.json file with the following variables.

    {
        "reactChance": 0.01,
        "reactWhitelist": [],
        "reactBlacklist": []
    }

These variables control where and how often the bot responds to messages. Note that this does not affect commands. The lists should contain the relevant channel IDs, which can be found by right clicking the channel name and copying the ID.

### Install Modules

    npm install

### Deploy Commands

New commands must be deployed before they can be used.

    node deploy-commands.js

### Starting the Bot

    node bot.js
# Warseeker Bot

This bot was developed for the World of Warcraft guild 'Warseeker Tribe', but is freely available to anyone who may be interested.

## Installation

### Secrets

Add a new file named 'secrets.json' to the json folder with the following variables.

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

### Install Modules

    npm install

### Deploy Commands

New commands must be deployed before they can be used.

    node deploy-commands.js

### Starting the Bot

    node bot.js
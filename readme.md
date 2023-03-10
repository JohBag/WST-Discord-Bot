# Warseeker Bot

This bot was developed for the World of Warcraft guild 'Warseeker Tribe', but is freely available to anyone who may have interest in it.

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

### Config

* name - The full name of the bot. Used internally for logging conversations.
* nicknames - Name variations, abbreviations, or other nicknames. Mainly used for checking if the bot was mentioned in a message.
* cutoff - Cutoff point in a conversation that prevents messages from before the cutoff point from being accessed and used to generate a response. Mainly used to prevent unwanted context.
* reactChance - The percentage chance of any message to trigger a response from the bot.
* reactWhitelist - Whitelist channels to react in. This will override the blacklist if not empty.
* reactBlacklist - Blacklist channels from reactions. Good idea to use for important channels or channels with sensitive content.

The react variables control where and how often the bot responds to messages. Note that this does not affect commands. The lists should contain the relevant channel IDs, which can be found by right clicking the channel name and copying the ID.

### Install Modules

    npm install

### Deploy Commands

New commands must be deployed before they can be used.

    node deploy-commands.js

### Starting the Bot

    node bot.js
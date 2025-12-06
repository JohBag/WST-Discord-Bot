# Warseeker Bot

A custom AI-powered Discord bot developed for the World of Warcraft guild 'Warseeker Tribe'. While built for our guild, the codebase is open and freely available to anyone who wants to run their own instance.

## Features

* **AI Integration:** Chat with the bot using natural language.
* **Voice Capability:** The bot can join voice channels to listen and speak.
* **Slash Commands:** Easy-to-use command interface.

## Prerequisites

* **Node.js:** Version 22.0.0 or higher.
* **FFmpeg:** Required for voice functionality.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/JohBag/WST-Discord-Bot.git
    cd WST-Discord-Bot
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Configuration

The bot requires the following files in the `config/` directory:

* `config.json` (Create from `config-example.json`)
* `secrets.json` (Create from `secrets-example.json`)
* `prompt.txt` (Contains your AI system prompt)

**Note:** Ensure `secrets.json` is never committed to version control.

## Setup

### Deploy Commands
You must register the slash commands with Discord before the bot can use them.

**First Run:**
```bash
node deploy-commands.js
```

**Updating Commands:**
If you modify the commands later, you must delete the old ones before re-deploying to avoid duplicates or cache issues:
```bash
node delete-commands.js
node deploy-commands.js
```

## Running the Bot

**For Testing (Development):**
```bash
node bot.js
```

**For Production (Recommended):**
Use PM2 to keep the bot running in the background and automatically restart if it crashes.
```bash
pm2 start bot.js --name "discord-bot"
```
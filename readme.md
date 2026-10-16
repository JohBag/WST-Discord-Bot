# Warseeker Bot

A custom AI-powered Discord bot developed for the World of Warcraft guild 'Warseeker Tribe'. While built for our guild, the codebase is open and freely available to anyone who wants to run their own instance.

## Features

* **AI chat:** Talk to the bot by mentioning it or using its nickname. It can also generate pictures, post Warcraft Logs reports and start votes when asked.
* **Warcraft Logs:** New raids are posted automatically and updated while they are being live-logged. `/log` posts a summary of any report: bosses killed, best pulls and who took part. Raids uploaded as personal logs by the uploaders listed in `config.json` count too.
* **Votes:** `/vote` starts a vote with buttons, optionally anonymous, and `/vote-edit` adds options to one.
* **Music:** `/music` opens a private control panel for playing songs from the `music/` folder in your voice channel: play/pause, skip, stop and a song picker. Without a chosen song, everything is shuffled on repeat.
* **New members:** Gives people who join the server a starting role.

## Prerequisites

* **Node.js:** Version 22.0.0 or higher.
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

The `config/` directory ships with a working configuration for our guild. Edit these files to point the bot at your own server:

* `config.json` (Guild and channel IDs, model names, and per-channel behaviour). The chat model can be a Gemini (`gemini-*`) or Claude (`claude-*`) model, and a channel can use its own by setting `model` in its `channelSettings`.
* `prompt.txt` (The AI system prompt)

To run a separate test bot locally, put the settings that differ in `config/config.local.json`. It is git-ignored and merged over `config.json` when present.

Create a `.env` file in the project root with your API keys (see `.env.example`). `ANTHROPIC_API_KEY` is only needed when a Claude model is configured.

## Setup

Build the bot and register its slash commands with Discord. Re-run `deploy-commands` whenever commands are added or changed; it replaces the full set, so `delete-commands` is only needed to remove them all.

```bash
npm run build
npm run deploy-commands
```

## Running the Bot

```bash
npm run build && npm start
```

In production the bot runs under [PM2](https://pm2.keymetrics.io/), which restarts it if it crashes:

```bash
pm2 start dist/bot.js --name botty --node-args="--env-file=.env"
```

## Deploying to the VM

`scripts/vm.mjs` runs maintenance commands on the bot's VM over SSH. It expects an SSH host alias `wst-vm` in `~/.ssh/config` that logs in as the user running the bot.

```bash
npm run deploy          # Pull main, install, build and restart the bot
npm run logs            # Show the last 50 lines of log.txt (npm run logs -- 200 for more)
npm run vm -- follow    # Stream log.txt live
npm run vm -- status    # Deployed commit and pm2 status
npm run vm -- restart   # Restart the bot without deploying
npm run vm -- commands  # Register slash commands for the production bot
npm run vm -- music     # Copy the local music/ folder to the VM
```

Music files are not in the repository: put them in the git-ignored `music/` folder and copy them over with `npm run vm -- music`.

## Comparing models and prompts

To try other models or prompts before switching, reply to saved conversations with each and compare the results blind. Everything is kept in the git-ignored `eval/` folder, since the conversations are real messages from the server.

```bash
npm run vm -- chats     # Export the 20 most recent conversations Botty replied to (chats --count 40 for more)
npm run compare         # Reply to each with every variant and write a comparison page
```

The first run creates `eval/variants.json`, which lists the model and prompt file of each variant. You can also add your own conversations as JSON files in `eval/conversations/`. The page in `eval/results/` shows the replies in random order: pick a favourite for each conversation, then reveal which variant wrote what along with the totals.

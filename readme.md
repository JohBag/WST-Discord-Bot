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
* `prompt.txt` (Contains your AI system prompt)

Create a `.env` file in the project root with your API keys (see `.env.example`).

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

## Testing Prompts

Before editing `config/prompt.txt` and restarting the bot, you can try a prompt against saved
conversations. Nothing is posted to Discord - the only network call is the same Gemini text
request the bot makes, built from the same conversation formatting.

```bash
npm run test-prompt                                     # config/prompt.txt vs every saved conversation
npm run test-prompt -- --runs 3                         # three replies each, to see the variance
npm run test-prompt -- -p config/prompt.txt -p config/prompt-example.txt   # compare two prompts
npm run test-prompt -- -c tools/conversations/raid-invite.txt --dry-run    # inspect the request, no API call
npm run test-prompt -- --help
```

Sample conversations live in `tools/conversations/`. Each is a plain transcript, one message per
line, in the format the bot itself sees:

```
# Lines starting with # are comments.
# expect: no-self-reference, no-ingame-promise
Deacon: Mythic Gallywix pull at 20:00, we need one more dps
Lath: I'm in
Deacon: botty you coming?
```

To add a case, paste a conversation out of Discord into a new `.txt` file in that directory.

The optional `# expect:` line opts the file into regex checks that flag known bad habits
(`no-self-reference` - Botty bringing up being a bot; `no-ingame-promise` - Botty claiming it will
act in-game). They are heuristics for spotting a trend across runs, not a verdict, so read the
replies too.

Lines are attributed to the bot when the speaker name matches `name` in `config.json`. If the
bot's guild nickname differs from that value, pass `--bot <nickname>` - and note that the live bot
has the same problem, since `modules/conversations.ts` uses `config.name` to decide which history
messages are its own.

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
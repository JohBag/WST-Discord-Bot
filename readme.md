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

Config is layered, so every instance shares one tracked file and only overrides what
differs. The bot deep-merges them at startup:

| File | Tracked | Purpose |
| --- | --- | --- |
| `config/config.base.json` | yes | Shared settings. Edit this and deploy with a `git pull`. |
| `config/config.json` | no | Per-instance overrides. Only the keys that differ on this machine. |
| `config/prompt.base.txt` | yes | The system prompt. Edit this and deploy with a `git pull`. |
| `config/prompt.txt` | no | Optional local prompt. Replaces the tracked one entirely when present. |

Nested keys merge one at a time, so a test instance needs only a few lines:

```json
{
	"name": "Warseeker Test Bot",
	"channelSettings": {
		"default": { "reactChance": 1 }
	}
}
```

That keeps `messageLimit`, every other channel, and the rest of the base config intact.
Arrays such as `nicknames` are replaced rather than combined.

Secrets never live in either file. Create a `.env` in the project root (see `.env.example`).

Check what an instance will actually run with before restarting it:

```bash
npm run check-config
```

It prints the merged result, marks which values came from the local override, and exits
non-zero on a missing key, a wrong type, an out-of-range `reactChance`, a misspelled key,
or a missing secret.

## Setup

### Deploy Commands
You must register the slash commands with Discord before the bot can use them.

**First Run:**
```bash
npm run deploy-commands
```

**Updating Commands:**
If you modify the commands later, you must delete the old ones before re-deploying to avoid duplicates or cache issues:
```bash
npm run delete-commands
npm run deploy-commands
```

## Testing Prompts

Before committing a prompt change, you can try it against saved conversations. Nothing is posted to Discord - the only network call is the same Gemini text
request the bot makes, built from the same conversation formatting.

```bash
npm run test-prompt                                     # current prompt vs every saved conversation
npm run test-prompt -- --runs 3                         # three replies each, to see the variance
npm run test-prompt -- -p config/prompt.base.txt -p /tmp/candidate.txt     # compare two prompts
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

Lines are attributed to the bot when the speaker name matches the merged `name`. If an instance's
guild nickname differs from that value, pass `--bot <nickname>` - and fix the config, because
`modules/conversations.ts` uses `config.name` to decide which history messages are the bot's own.

## Running the Bot

**For Testing (Development):**
```bash
npm start
```

**For Production (Recommended):**
Use PM2 to keep the bot running in the background and automatically restart if it crashes.
```bash
pm2 start dist/bot.js --name "discord-bot" --node-args="--env-file=.env"
pm2 save
```

## Deploying

On the server:

```bash
./deploy.sh
```

That pulls, installs, builds, runs the tests, verifies the config, and only then restarts
pm2. If any step fails it stops before touching the running process, so the current bot
stays up. Use `./deploy.sh --no-pull` to deploy what is already checked out, and set
`APP_NAME` if the pm2 process is not called `discord-bot`.

Because the shared config and the prompt are tracked, changing either is a normal commit
plus a `git pull` - only genuinely machine-specific values need editing on the server.
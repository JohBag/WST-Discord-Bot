# CLAUDE.md

Discord bot for the WoW guild Warseeker Tribe: Gemini-powered chat and voice, slash commands, and Warcraft Logs report embeds. TypeScript (ESM, NodeNext), compiled to `dist/` with `tsc`.

## This repository is public

- Never commit secrets. API keys live only in `.env` (see `.env.example`), loaded with `node --env-file=.env`.
- Do not read `.env`, `config/secrets.json` or any other credential file, locally or on the VM. Check that a variable is set without printing its value.
- `config/config.json` and `config/prompt.txt` are committed on purpose and must stay free of secrets.
- Keep machine-specific details (IP addresses, usernames) out of committed files. The VM is reached through the SSH alias `wst-vm`, defined only in the local `~/.ssh/config`.

## Commands

```bash
npm run build     # Wipe dist/ and compile
npm test          # Build, then run every *.test.ts (compiled into dist/)
npm start         # Run the bot locally (needs .env)
npm run deploy-commands / delete-commands   # Register or remove slash commands with Discord
```

## Layout

All source is in `src/` and compiles to `dist/` with the same structure (`src/bot.ts` becomes `dist/bot.js`, which pm2 runs). Tests sit next to the code they cover as `*.test.ts`.

- `bot.ts`: creates the client, wires events through `safeHandler` and loads commands. `core/clear-log.js` must stay its first import.
- `commands/`, `events/`: slash commands (`data` builder plus `execute`, typed by `BotCommand`) and Discord event handlers (`BotEvent`). Each folder's `index.ts` lists what gets loaded, so a new command or event must be exported there.
- `core/`: shared plumbing. `config.ts` loads config and secrets, `log.ts` writes to the console and `log.txt`, `storage.ts` reads and writes JSON files in `config/`, `message.ts` builds and sends messages, `user-error.ts` marks errors whose message should be shown to the user.
- `ai/`: AI provider code (currently `gemini.ts`).
- `features/`: one folder per feature. `chat/` decides when to reply and builds the conversation, `votes/` handles button votes, `warcraft-logs/` talks to the Warcraft Logs GraphQL API (`raids.ts` finds raid nights across guild and uploader reports and merges duplicates, `auto-post.ts` polls for new raids and edits its posts while they are live-logged, remembering them in the git-ignored `config/warcraft-logs-posts.json`), `music/` plays files from the git-ignored `music/` folder in voice channels by piping them through ffmpeg as Ogg Opus. ffmpeg comes from the `ffmpeg-static` npm package, since the VM's Debian 11 can no longer install packages reliably.

Commands can return a string to keep it as their private reply, throw `UserError` to show a message, and implement `autocomplete` for options marked with `setAutocomplete(true)`.
- `config/config.json`: the production config (guild/channel IDs, model names, per-channel settings), typed by `Config` in `src/types.ts`. A git-ignored `config/config.local.json` is deep-merged over it when present, for running a local test bot. Never put test values in `config.json`.

## Production

The bot runs on a Debian VM under pm2 (process name `botty`), from `~/wst`, using Node 22 installed through nvm. Non-interactive SSH sessions use the system Node 18 unless `~/.nvm/nvm.sh` is sourced first, which `scripts/vm.mjs` does.

```bash
npm run deploy          # Pull main, npm ci, build, pm2 restart
npm run logs            # Last 50 lines of log.txt (npm run logs -- 200 for more)
npm run vm -- follow    # Stream log.txt
npm run vm -- status    # Deployed commit and pm2 status
npm run vm -- restart   # Restart without deploying
npm run vm -- commands  # Register slash commands for the production bot (after adding or changing a command)
npm run vm -- music     # Copy the local music/ folder to the VM
```

`log.txt` is cleared every time the bot starts, so read it before restarting or deploying when investigating a problem. pm2 keeps its own copy of stdout in `~/.pm2/logs/`.

Deploys pull from `origin/main`, so changes must be pushed first. Ask before pushing.

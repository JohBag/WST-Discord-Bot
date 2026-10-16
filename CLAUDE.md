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
npm test          # Build, then run node:test suites in dist/tests/
npm start         # Run the bot locally (needs .env)
npm run deploy-commands / delete-commands   # Register or remove slash commands with Discord
```

## Layout

- `bot.ts`: creates the client, wires events through `safeHandler` and loads commands.
- `index/commands.ts`, `index/events.ts`: barrel files. A new command or event must be exported here to be loaded.
- `commands/`: slash commands (`data` builder plus `execute`), typed by `BotCommand` in `types.ts`.
- `events/`: Discord event handlers, typed by `BotEvent`.
- `modules/`: shared logic. `data.ts` loads config and secrets, `log.ts` writes to the console and `log.txt`, `gemini.ts` and `generate-response.ts` handle AI, `warcraft-log.ts` talks to the Warcraft Logs GraphQL API.
- `config/config.json`: the production config (guild/channel IDs, model names, per-channel settings), typed by `Config` in `types.ts`. A git-ignored `config/config.local.json` is deep-merged over it when present, for running a local test bot. Never put test values in `config.json`.

## Production

The bot runs on a Debian VM under pm2 (process name `botty`), from `~/wst`, using Node 22 installed through nvm. Non-interactive SSH sessions use the system Node 18 unless `~/.nvm/nvm.sh` is sourced first, which `scripts/vm.mjs` does.

```bash
npm run deploy          # Pull main, npm ci, build, pm2 restart
npm run logs            # Last 50 lines of log.txt (npm run logs -- 200 for more)
npm run vm -- follow    # Stream log.txt
npm run vm -- status    # Deployed commit and pm2 status
npm run vm -- restart   # Restart without deploying
```

`log.txt` is cleared every time the bot starts, so read it before restarting or deploying when investigating a problem. pm2 keeps its own copy of stdout in `~/.pm2/logs/`.

Deploys pull from `origin/main`, so changes must be pushed first. Ask before pushing.

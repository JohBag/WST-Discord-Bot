#!/usr/bin/env bash
#
# Deploy the bot on the VM: pull, build, verify, restart.
#
#   ./deploy.sh              pull and deploy
#   ./deploy.sh --no-pull    deploy what is already checked out
#
# Stops before touching the running process if anything fails, so a bad config
# or a broken build leaves the current bot up.

set -euo pipefail

APP_NAME="${APP_NAME:-discord-bot}"
cd "$(dirname "$0")"

pull=true
for arg in "$@"; do
	case "$arg" in
		--no-pull) pull=false ;;
		*) echo "Unknown option: $arg" >&2; exit 1 ;;
	esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

if [ "$pull" = true ]; then
	step "Pulling"
	before=$(git rev-parse HEAD)
	git pull --ff-only
	after=$(git rev-parse HEAD)

	if [ "$before" = "$after" ]; then
		echo "Already up to date."
	else
		git --no-pager log --oneline "$before..$after"
	fi
fi

step "Installing dependencies"
npm ci

step "Building"
npm run build

step "Running tests"
npm test

step "Checking config"
npm run check-config

step "Restarting $APP_NAME"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
	pm2 restart "$APP_NAME" --update-env
else
	echo "No pm2 process named '$APP_NAME', starting it."
	pm2 start dist/bot.js --name "$APP_NAME" --node-args="--env-file=.env"
fi
pm2 save

step "Done"
pm2 describe "$APP_NAME" | grep -E 'status|restarts' || true
echo
echo "Logs: pm2 logs $APP_NAME"

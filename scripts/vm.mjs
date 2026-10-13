// Runs maintenance commands on the bot's VM over SSH.
// Expects an SSH host alias "wst-vm" in ~/.ssh/config pointing at the bot's user.
import { spawnSync } from 'node:child_process';

const host = process.env.VM_HOST ?? 'wst-vm';
const dir = '~/wst';
const pm2Name = process.env.PM2_NAME ?? 'botty';
// Non-interactive SSH sessions don't load nvm, so the system Node would be used otherwise
const nvm = 'source ~/.nvm/nvm.sh';

const commands = {
	deploy: `${nvm} && cd ${dir} && git pull --ff-only && npm ci && npm run build && pm2 restart ${pm2Name} && pm2 ls`,
	logs: `tail -n ${process.argv[3] ?? 50} ${dir}/log.txt`,
	follow: `tail -n 20 -f ${dir}/log.txt`,
	status: `${nvm} && cd ${dir} && git log -1 --oneline && git status -sb | head -5 && pm2 ls`,
	restart: `${nvm} && pm2 restart ${pm2Name} && pm2 ls`
};

const command = commands[process.argv[2]];
if (!command) {
	console.error(`Usage: npm run vm -- <${Object.keys(commands).join('|')}>`);
	process.exit(1);
}

const result = spawnSync('ssh', ['-o', 'LogLevel=ERROR', host, command], { stdio: 'inherit' });
process.exit(result.status ?? 1);

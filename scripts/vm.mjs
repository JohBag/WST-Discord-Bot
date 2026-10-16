// Runs maintenance commands on the bot's VM over SSH.
// Expects an SSH host alias "wst-vm" in ~/.ssh/config pointing at the bot's user.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const host = process.env.VM_HOST ?? 'wst-vm';
const dir = '~/wst';
const pm2Name = process.env.PM2_NAME ?? 'botty';
// Non-interactive SSH sessions don't load nvm, so the system Node would be used otherwise
const nvm = 'source ~/.nvm/nvm.sh';

const remoteCommands = {
	deploy: `${nvm} && cd ${dir} && git pull --ff-only && npm ci && npm run build && pm2 restart ${pm2Name} && pm2 ls`,
	// Registers slash commands with the production bot's credentials, which only exist on the VM
	commands: `${nvm} && cd ${dir} && npm run deploy-commands`,
	logs: `tail -n ${process.argv[3] ?? 50} ${dir}/log.txt`,
	follow: `tail -n 20 -f ${dir}/log.txt`,
	status: `${nvm} && cd ${dir} && git log -1 --oneline && git status -sb | head -5 && pm2 ls`,
	restart: `${nvm} && pm2 restart ${pm2Name} && pm2 ls`
};

const localCommands = {
	// Copies the git-ignored music folder; existing files on the VM are overwritten, none are deleted
	music: () => spawnSync('scp', ['-o', 'LogLevel=ERROR', '-r', 'music', `${host}:wst/`], { stdio: 'inherit' }),
	// Saves recent conversations Botty replied to into eval/, for npm run compare. Reading the guild
	// needs the production bot's token, so the export runs on the VM and the file is copied back.
	chats: () => {
		const file = 'eval/conversations/discord.json';
		const args = process.argv.slice(3).join(' ');
		const exported = spawnSync('ssh', ['-o', 'LogLevel=ERROR', host, `${nvm} && cd ${dir} && node --env-file=.env dist/tools/export-chats.js ${args}`], { stdio: 'inherit' });
		if (exported.status !== 0) {
			return exported;
		}
		fs.mkdirSync('eval/conversations', { recursive: true });
		const copied = spawnSync('scp', ['-o', 'LogLevel=ERROR', `${host}:wst/${file}`, file], { stdio: 'inherit' });
		// The messages are only needed here
		spawnSync('ssh', ['-o', 'LogLevel=ERROR', host, `rm -rf ${dir}/eval`], { stdio: 'inherit' });
		return copied;
	},
};

const name = process.argv[2];
let result;
if (name in remoteCommands) {
	result = spawnSync('ssh', ['-o', 'LogLevel=ERROR', host, remoteCommands[name]], { stdio: 'inherit' });
} else if (name in localCommands) {
	result = localCommands[name]();
} else {
	console.error(`Usage: npm run vm -- <${[...Object.keys(remoteCommands), ...Object.keys(localCommands)].join('|')}>`);
	process.exit(1);
}
process.exit(result.status ?? 1);

/**
 * Prompt test harness - try a system prompt against saved conversations without going live.
 *
 * npm run test-prompt
 * npm run test-prompt -- --prompt config/prompt.txt --prompt config/prompt-example.txt --runs 3
 * npm run test-prompt -- --conversation tools/conversations/bot-reminders.txt --dry-run
 *
 * Nothing is sent to Discord. The only network call is the same Gemini text
 * request the bot makes, built from the same conversation formatting.
 */

// Keep the harness out of the running bot's log file. Must be set before
// modules/log.js is evaluated, so anything touching it is imported dynamically below.
process.env.LOG_FILE ||= 'log-prompt-test.txt';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkResponse, detectors, parseTranscript, type Transcript } from './transcript.js';

function colour(code: string) {
	return (text: string) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
}
const bold = colour('1');
const dim = colour('2');
const red = colour('31');

// Same resolution the bot uses: the git-ignored local prompt wins, else the committed one
const DEFAULT_PROMPT = fs.existsSync('config/prompt.txt') ? 'config/prompt.txt' : 'config/prompt.base.txt';
const DEFAULT_CONVERSATIONS = 'tools/conversations';

const { values } = parseArgs({
	options: {
		prompt: { type: 'string', multiple: true, short: 'p' },
		conversation: { type: 'string', multiple: true, short: 'c' },
		runs: { type: 'string', short: 'r', default: '1' },
		bot: { type: 'string', short: 'b' },
		'no-functions': { type: 'boolean', default: false },
		'dry-run': { type: 'boolean', default: false },
		help: { type: 'boolean', short: 'h', default: false },
	},
	allowPositionals: false,
});

if (values.help) {
	printHelp();
	process.exit(0);
}

const runs = Number(values.runs);
if (!Number.isInteger(runs) || runs < 1) {
	fail(`--runs must be a positive integer, got "${values.runs}"`);
}

const promptFiles = (values.prompt?.length ? values.prompt : [DEFAULT_PROMPT]).map(resolvePromptFile);
const transcripts = collectTranscripts(values.conversation?.length ? values.conversation : [DEFAULT_CONVERSATIONS]);

if (transcripts.length === 0) {
	fail('No conversations found. Pass --conversation <file> or add transcripts to ' + DEFAULT_CONVERSATIONS);
}

if (!fs.existsSync('config/config.base.json')) {
	fail('config/config.base.json is missing. It is tracked in git - run a git pull.');
}

// Imported late so LOG_FILE above takes effect
const { config } = await import('../modules/data.js');
const { toConversationEntry } = await import('../modules/conversations.js');

const botName = values.bot ?? config.name;

if (!values['dry-run'] && !process.env.GEMINI_API_KEY) {
	fail('GEMINI_API_KEY is not set. Add it to .env, or use --dry-run to inspect the request without calling the API.');
}

interface Tally {
	responses: number;
	failures: number;
	flags: Map<string, number>;
}

const tallies = new Map<string, Tally>();

console.log(`Bot name: ${bold(botName)}   runs per conversation: ${bold(String(runs))}${values['dry-run'] ? '   ' + bold('(dry run)') : ''}`);
if (!transcripts.some(transcript => transcript.messages.some(message => message.name === botName))) {
	console.log(dim(`Note: no message in these transcripts is attributed to "${botName}", so none are marked as Botty's own turns. Use --bot <name> if that is wrong.`));
}

for (const promptFile of promptFiles) {
	const systemPrompt = fs.readFileSync(promptFile, 'utf8');
	const tally: Tally = { responses: 0, failures: 0, flags: new Map() };
	tallies.set(promptFile, tally);

	console.log(`\n${'='.repeat(72)}\nPROMPT  ${bold(promptFile)}  (${systemPrompt.length} chars)\n${'='.repeat(72)}`);

	for (const transcript of transcripts) {
		const conversation = transcript.messages.map(message => toConversationEntry(message.name, message.content, botName));
		const lastLine = transcript.messages[transcript.messages.length - 1];

		console.log(`\n--- ${bold(transcript.name)} (${conversation.length} messages)`);
		console.log(dim(`    last: ${lastLine ? truncate(`${lastLine.name}: ${lastLine.content}`, 90) : '(empty)'}`));
		if (transcript.expectations.length > 0) {
			console.log(dim(`    expect: ${transcript.expectations.join(', ')}`));
		}

		if (values['dry-run']) {
			console.log(dim('    [dry run] request that would be sent:'));
			for (const entry of conversation) {
				console.log(dim(`      ${entry.role.padEnd(5)} | ${truncate(entry.parts[0].text, 100)}`));
			}
			continue;
		}

		for (let run = 1; run <= runs; run++) {
			const label = runs > 1 ? `  [run ${run}/${runs}]` : '';
			const result = await ask(systemPrompt, conversation);

			if (!result.ok) {
				tally.failures++;
				console.log(`${red('  ERROR')}${label}: ${result.error}`);
				continue;
			}

			tally.responses++;
			for (const call of result.functionCalls) {
				console.log(`  ${dim('function call:')} ${call}`);
			}
			console.log(`  ${bold('Botty')}${label}: ${result.text || dim('(no text)')}`);

			for (const check of checkResponse(result.text, transcript.expectations)) {
				if (!check.triggered) {
					continue;
				}
				tally.flags.set(check.id, (tally.flags.get(check.id) ?? 0) + 1);
				console.log(`  ${red('FLAG')} ${check.id}: ${check.description}`);
			}
		}
	}
}

if (!values['dry-run'] && promptFiles.length > 0) {
	console.log(`\n${'='.repeat(72)}\nSUMMARY\n${'='.repeat(72)}`);
	for (const [promptFile, tally] of tallies) {
		const flags = detectors
			.map(detector => `${detector.id}: ${tally.flags.get(detector.id) ?? 0}`)
			.join('   ');
		const failures = tally.failures > 0 ? red(`   errors: ${tally.failures}`) : '';
		console.log(`${promptFile}\n  responses: ${tally.responses}   ${flags}${failures}`);
	}
	console.log(dim('\nFlags are regex heuristics over the responses that opted in via "# expect:". Read the replies too.'));
}

// ----- helpers ----- //

interface AskResult {
	ok: boolean;
	text: string;
	functionCalls: string[];
	error?: string;
}

async function ask(systemPrompt: string, conversation: unknown[]): Promise<AskResult> {
	try {
		const { generateResponse } = await import('../modules/gemini.js');
		const response = await generateResponse(systemPrompt, conversation, !values['no-functions']);
		return {
			ok: true,
			text: response.text ?? '',
			functionCalls: (response.functionCalls ?? []).map(call => `${call.name}(${JSON.stringify(call.args ?? {})})`),
		};
	} catch (error) {
		return { ok: false, text: '', functionCalls: [], error: String(error) };
	}
}

function resolvePromptFile(file: string): string {
	if (!fs.existsSync(file)) {
		fail(`Prompt file not found: ${file}`);
	}
	return file;
}

function collectTranscripts(inputs: string[]): Transcript[] {
	const files: string[] = [];

	for (const input of inputs) {
		if (!fs.existsSync(input)) {
			fail(`Conversation not found: ${input}`);
		}
		if (fs.statSync(input).isDirectory()) {
			files.push(...fs.readdirSync(input).filter(file => file.endsWith('.txt')).sort().map(file => path.join(input, file)));
		} else {
			files.push(input);
		}
	}

	return files.map(file => parseTranscript(fs.readFileSync(file, 'utf8'), path.basename(file, '.txt')));
}

function truncate(text: string, limit: number): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	return flat.length <= limit ? flat : `${flat.slice(0, limit - 1)}…`;
}

function fail(message: string): never {
	console.error(red(`Error: ${message}`));
	process.exit(1);
}

function printHelp(): void {
	console.log(`Try a system prompt against saved conversations. Nothing is posted to Discord.

Options:
  -p, --prompt <file>        Prompt file to test, repeatable to compare (default: ${DEFAULT_PROMPT})
  -c, --conversation <path>  Transcript file or directory (default: ${DEFAULT_CONVERSATIONS})
  -r, --runs <n>             Responses per conversation, to see variance (default: 1)
  -b, --bot <name>           Name that marks Botty's own lines (default: config.json "name")
      --no-functions         Disable the tool declarations
      --dry-run              Print the assembled request without calling Gemini
  -h, --help                 Show this help

Transcript format - one message per line, "Name: text". Lines starting with # are
comments; "# expect: no-self-reference, no-ingame-promise" opts the file into checks.
Available checks: ${detectors.map(d => d.id).join(', ')}`);
}

// Replies to saved conversations with every model and prompt in eval/variants.json, and writes a page
// that shows the replies side by side without saying which is which.
//
// npm run compare [-- --variants eval/variants.json]
import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { config } from '../core/config.js';
import { generateReply } from '../ai/chat.js';
import { conversationsDir, resultsDir, variantsFile } from './eval.js';
import type { EvalConversation, Variant, VariantsFile } from './eval.js';
import { renderPage } from './compare-page.js';
import type { Candidate, Comparison } from './compare-page.js';

// Requests in flight at once
const concurrency = 4;

const { values } = parseArgs({
	options: {
		variants: { type: 'string', default: variantsFile },
	},
});

function loadVariants(file: string): VariantsFile {
	if (!fs.existsSync(file)) {
		// The current setup against each Claude model, with the prompt kept the same
		const starter: VariantsFile = {
			runs: 1,
			includeOriginal: true,
			variants: [config.models.text, 'claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']
				.map(model => ({ model, prompt: 'config/prompt.txt' })),
		};
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(starter, null, '\t'));
		console.log(`Created ${file} with the current model and three Claude models. Edit it to compare others.`);
	}
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadConversations(): EvalConversation[] {
	if (!fs.existsSync(conversationsDir)) {
		return [];
	}
	return fs.readdirSync(conversationsDir)
		.filter(file => file.endsWith('.json'))
		.flatMap(file => JSON.parse(fs.readFileSync(path.join(conversationsDir, file), 'utf8')) as EvalConversation[]);
}

function variantName(variant: Variant): string {
	return variant.name ?? `${variant.model} · ${path.basename(variant.prompt, path.extname(variant.prompt))}`;
}

async function runAll<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
	const results: T[] = new Array(jobs.length);
	let next = 0;
	async function worker() {
		while (next < jobs.length) {
			const index = next++;
			results[index] = await jobs[index]();
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
	return results;
}

function shuffle<T>(items: T[]): T[] {
	const shuffled = [...items];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

const setup = loadVariants(values.variants);
const conversations = loadConversations();
if (conversations.length === 0) {
	console.error(`No conversations in ${conversationsDir}/. Export some from Discord with: npm run vm -- chats`);
	process.exit(1);
}

const prompts = new Map(setup.variants.map(variant => [variant.prompt, fs.readFileSync(variant.prompt, 'utf8')]));

const jobs = conversations.flatMap(conversation => setup.variants.flatMap((variant, variantIndex) =>
	Array.from({ length: setup.runs }, () => async (): Promise<Candidate> => {
		const started = Date.now();
		try {
			const reply = await generateReply({
				model: variant.model,
				systemPrompt: prompts.get(variant.prompt)!,
				conversation: conversation.messages,
				tools: true,
			});
			return { variant: variantIndex, text: reply.text, toolCalls: reply.toolCalls, ms: Date.now() - started, usage: reply.usage };
		} catch (error) {
			return { variant: variantIndex, text: '', toolCalls: [], ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
		}
	})));

console.log(`${jobs.length} replies to generate: ${conversations.length} conversations × ${setup.variants.length} variants × ${setup.runs} run(s)`);
const candidates = await runAll(jobs, concurrency);

const perConversation = setup.variants.length * setup.runs;
const comparison: Comparison = {
	createdAt: new Date().toISOString(),
	variants: setup.variants.map(variantName),
	conversations: conversations.map((conversation, i) => {
		const own = candidates.slice(i * perConversation, (i + 1) * perConversation);
		if (setup.includeOriginal && conversation.original) {
			own.push({ variant: -1, text: conversation.original, toolCalls: [], ms: 0 });
		}
		return { ...conversation, candidates: shuffle(own) };
	}),
};

const failures = candidates.filter(candidate => candidate.error);
for (const failure of failures.slice(0, 5)) {
	console.log(`Failed (${comparison.variants[failure.variant]}): ${failure.error}`);
}

fs.mkdirSync(resultsDir, { recursive: true });
const file = path.resolve(resultsDir, `${comparison.createdAt.slice(0, 16).replace(/[:T]/g, '-')}.html`);
fs.writeFileSync(file, renderPage(comparison, config.name));
console.log(`${failures.length} failed. Open the comparison in a browser:\n${file}`);

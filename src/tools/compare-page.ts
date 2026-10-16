// The page npm run compare writes: one card per conversation with the replies in random order.
// Pick a favourite in each, then reveal which model and prompt wrote what. Picks are kept in the browser.
import type { ToolCall } from '../ai/conversation.js';
import type { EvalConversation } from './eval.js';

export interface Candidate {
	// Index into Comparison.variants, or -1 for what the bot actually said
	variant: number;
	text: string;
	toolCalls: ToolCall[];
	ms: number;
	usage?: { inputTokens: number; outputTokens: number };
	error?: string;
}

export interface Comparison {
	createdAt: string;
	variants: string[];
	conversations: (EvalConversation & { candidates: Candidate[] })[];
}

export function renderPage(comparison: Comparison, botName: string): string {
	// Stops a message containing "</script>" from ending the data block early
	const data = JSON.stringify({ ...comparison, botName }).replace(/</g, '\\u003c');
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reply Comparison</title>
<style>${styles}</style>
</head>
<body>
<header>
	<div class="bar">
		<h1>Reply comparison</h1>
		<span id="progress"></span>
		<button id="reveal" type="button"></button>
	</div>
</header>
<main>
	<p class="intro">Pick the reply you like best in each conversation. The replies are shuffled and unlabelled; reveal shows who wrote what and the totals.</p>
	<section id="scores" hidden></section>
	<div id="conversations"></div>
	<p class="actions"><button id="clear" type="button" class="quiet">Clear my picks</button></p>
</main>
<script id="data" type="application/json">${data}</script>
<script>${script}</script>
</body>
</html>
`;
}

const styles = `
:root {
	--bg: #f6f5f2; --card: #ffffff; --text: #1f2328; --muted: #656d76; --line: #d8dee4;
	--accent: #5865f2; --accent-soft: #eef0ff; --bot: #f2f3f5; --error: #c62828;
}
@media (prefers-color-scheme: dark) {
	:root {
		--bg: #1e1f22; --card: #2b2d31; --text: #e6e7e9; --muted: #a0a4ab; --line: #3f4248;
		--accent: #8891f7; --accent-soft: #33365a; --bot: #34363c; --error: #ff8a80;
	}
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { position: sticky; top: 0; z-index: 1; background: var(--bg); border-bottom: 1px solid var(--line); }
.bar, main { max-width: 860px; margin: 0 auto; padding: 0 16px; }
.bar { display: flex; align-items: center; gap: 12px; min-height: 56px; }
h1 { font-size: 18px; margin: 0; flex: 1; }
#progress { color: var(--muted); font-size: 14px; }
button { font: inherit; cursor: pointer; }
#reveal { background: var(--accent); color: #fff; border: 0; border-radius: 6px; padding: 6px 14px; }
.quiet { background: none; border: 1px solid var(--line); color: var(--muted); border-radius: 6px; padding: 4px 12px; }
.intro { color: var(--muted); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin: 16px 0; }
.meta { color: var(--muted); font-size: 13px; margin: 0 0 10px; }
.chat { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 4px; }
.chat li { padding: 2px 8px; border-radius: 6px; overflow-wrap: anywhere; white-space: pre-wrap; }
.chat li.bot { background: var(--bot); }
.chat b { margin-right: 6px; }
h2 { font-size: 14px; color: var(--muted); font-weight: 600; margin: 0 0 8px; }
.candidates { display: grid; gap: 8px; }
.candidate { display: grid; grid-template-columns: 28px 1fr; gap: 10px; text-align: left; color: inherit; background: none; border: 2px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.candidate:hover { border-color: var(--accent); }
.candidate.picked { border-color: var(--accent); background: var(--accent-soft); }
.letter { font-weight: 700; color: var(--accent); }
.reply { white-space: pre-wrap; overflow-wrap: anywhere; }
.tool { font-family: ui-monospace, Consolas, monospace; font-size: 13px; color: var(--muted); }
.error { color: var(--error); }
.who { grid-column: 2; font-size: 13px; color: var(--muted); border-top: 1px dashed var(--line); padding-top: 6px; }
.who b { color: var(--text); }
.none { margin-top: 8px; }
.none.picked { border-color: var(--accent); color: var(--text); }
#scores { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin: 16px 0; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: right; padding: 4px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
th:first-child, td:first-child { text-align: left; white-space: normal; }
.actions { text-align: center; margin: 24px 0 48px; }
`;

const script = `
const data = JSON.parse(document.getElementById('data').textContent);
const storageKey = 'compare:' + data.createdAt;
let picks = {};
let revealed = false;
try { picks = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch {}

function save() {
	try { localStorage.setItem(storageKey, JSON.stringify(picks)); } catch {}
}

function variantName(index) {
	return index === -1 ? 'What ' + data.botName + ' actually said' : data.variants[index];
}

function el(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function describeCall(call) {
	const args = Object.entries(call.args || {}).map(([key, value]) => key + ': ' + JSON.stringify(value)).join(', ');
	return '→ would call ' + call.name + '(' + args + ')';
}

function renderConversation(conversation) {
	const card = el('section', 'card');
	const meta = [conversation.channel && '#' + conversation.channel, conversation.date && new Date(conversation.date).toLocaleString()].filter(Boolean);
	card.append(el('p', 'meta', meta.join(' · ') || conversation.id));

	const chat = el('ol', 'chat');
	for (const message of conversation.messages) {
		const line = el('li', message.fromBot ? 'bot' : '');
		line.append(el('b', '', message.author), document.createTextNode(message.content));
		chat.append(line);
	}
	card.append(chat, el('h2', '', 'Which reply is best?'));

	const list = el('div', 'candidates');
	conversation.candidates.forEach((candidate, i) => {
		const button = el('button', 'candidate' + (picks[conversation.id] === i ? ' picked' : ''));
		button.type = 'button';
		button.append(el('span', 'letter', String.fromCharCode(65 + i)));
		const body = el('div');
		if (candidate.error) body.append(el('div', 'error', 'Error: ' + candidate.error));
		if (candidate.text) body.append(el('div', 'reply', candidate.text));
		for (const call of candidate.toolCalls) body.append(el('div', 'tool', describeCall(call)));
		if (!candidate.error && !candidate.text && candidate.toolCalls.length === 0) body.append(el('div', 'error', '(empty reply)'));
		button.append(body);
		if (revealed) {
			const who = el('div', 'who');
			who.append(el('b', '', variantName(candidate.variant)));
			if (candidate.variant !== -1) {
				who.append(document.createTextNode(' · ' + (candidate.ms / 1000).toFixed(1) + ' s' + (candidate.usage ? ' · ' + candidate.usage.outputTokens + ' tokens out' : '')));
			}
			button.append(who);
		}
		button.addEventListener('click', () => pick(conversation.id, i));
		list.append(button);
	});
	card.append(list);

	const none = el('button', 'quiet none' + (picks[conversation.id] === 'none' ? ' picked' : ''), 'None of them are good');
	none.type = 'button';
	none.addEventListener('click', () => pick(conversation.id, 'none'));
	card.append(none);
	return card;
}

function pick(id, choice) {
	if (picks[id] === choice) delete picks[id]; else picks[id] = choice;
	save();
	render();
}

function average(values) {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function renderScores() {
	const rows = [...data.variants.map((_, i) => i), -1].map(variant => {
		const own = data.conversations.flatMap(c => c.candidates.filter(x => x.variant === variant));
		if (own.length === 0) return null;
		const wins = data.conversations.filter(c => typeof picks[c.id] === 'number' && c.candidates[picks[c.id]].variant === variant).length;
		const ok = own.filter(x => !x.error);
		return {
			name: variantName(variant),
			wins,
			seconds: variant === -1 ? '' : average(ok.map(x => x.ms)).toFixed(1),
			length: Math.round(average(ok.map(x => x.text.length))),
			tools: ok.filter(x => x.toolCalls.length).length,
			errors: own.length - ok.length,
		};
	}).filter(Boolean).sort((a, b) => b.wins - a.wins);

	const none = Object.values(picks).filter(p => p === 'none').length;
	const scores = document.getElementById('scores');
	scores.innerHTML = '<table><thead><tr><th>Who</th><th>Favourite</th><th>Avg time (s)</th><th>Avg length</th><th>Tool calls</th><th>Errors</th></tr></thead><tbody></tbody></table>';
	const body = scores.querySelector('tbody');
	for (const row of rows) {
		const tr = el('tr');
		for (const value of [row.name, row.wins, row.seconds, row.length, row.tools, row.errors]) tr.append(el('td', '', String(value)));
		body.append(tr);
	}
	if (none) scores.append(el('p', 'meta', none + ' marked as none of them good.'));
}

function render() {
	const picked = data.conversations.filter(c => picks[c.id] !== undefined).length;
	document.getElementById('progress').textContent = picked + ' of ' + data.conversations.length + ' picked';
	document.getElementById('reveal').textContent = revealed ? 'Hide' : 'Reveal';
	document.getElementById('scores').hidden = !revealed;
	if (revealed) renderScores();
	const container = document.getElementById('conversations');
	container.replaceChildren(...data.conversations.map(renderConversation));
}

document.getElementById('reveal').addEventListener('click', () => { revealed = !revealed; render(); });
document.getElementById('clear').addEventListener('click', () => { picks = {}; save(); render(); });
render();
`;

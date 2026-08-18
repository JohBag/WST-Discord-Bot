// Pure parsing + heuristics for the prompt test harness. No side effects, no network.

export interface TranscriptMessage {
	name: string;
	content: string;
}

export interface Transcript {
	name: string;
	expectations: string[];
	messages: TranscriptMessage[];
}

export interface Detector {
	id: string;
	description: string;
	pattern: RegExp;
}

// Heuristics, not judgement. They catch the obvious phrasings and nothing more.
export const detectors: Detector[] = [
	{
		id: 'no-self-reference',
		description: 'Botty brings up being a bot / AI / code / hardware unprompted',
		pattern: /(\b(i'?m|i am|im)\s+(just\s+|only\s+|merely\s+)?(a|an)\s+(bot|ai|robot|program|script|chat\s?bot|text\s?bot)\b|\bas\s+(a|an)\s+(bot|ai|robot)\b|\bmy\s+(code|coding|cpu|circuits|servers?|server\s?rack|programming|hosting|algorithms?|wiring|hard\s?drive)\b|\bserver\s+(rack|hosting|fees)\b|\bhosting\s+fees\b|\bdial-?up\b|\bbeep\s?boop\b|\bi'?m\s+not\s+(a\s+)?(real|human|player)\b|\b(just|only)\s+a\s+(bot|text\s?bot|chat\s?bot)\b|🤖)/i,
	},
	{
		id: 'no-ingame-promise',
		description: 'Botty claims it will act in-game or in the real world',
		pattern: /\b(i'?ll|i will|i can|i'?m gonna|i am going to|lemme|let me)\s+(be there|come along|join(\s+you|\s+the)?|invite|log\s?in|log\s?on|hop\s?on|queue|sign\s+up|meet\s+you|tag\s+along|res|rez|heal|tank|carry|run\s+it|whisper|mail|trade|summon|port|check\s+(the\s+)?(ah|auction|armory))\b|\bsee\s+you\s+(in-?game|in\s+azeroth|on\s+the\s+raid|there\s+tonight)\b/i,
	},
];

export function parseTranscript(text: string, name: string): Transcript {
	const expectations: string[] = [];
	const messages: TranscriptMessage[] = [];

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();

		if (line === '') {
			continue;
		}

		if (line.startsWith('#')) {
			const expect = /^#\s*expect:\s*(.*)$/i.exec(line);
			if (expect) {
				expectations.push(...expect[1].split(',').map(entry => entry.trim()).filter(Boolean));
			}
			continue;
		}

		const speaker = parseSpeakerLine(line);
		if (speaker) {
			messages.push(speaker);
		} else if (messages.length > 0) {
			// Continuation of the previous message (multi-line posts, pasted links)
			messages[messages.length - 1].content += `\n${line}`;
		}
	}

	const unknown = expectations.filter(id => !detectors.some(detector => detector.id === id));
	if (unknown.length > 0) {
		throw new Error(`${name}: unknown expectation(s) ${unknown.join(', ')}. Known: ${detectors.map(d => d.id).join(', ')}`);
	}

	return { name, expectations, messages };
}

function parseSpeakerLine(line: string): TranscriptMessage | null {
	// URLs and timestamps contain colons but are not speakers
	if (/^\w+:\/\//.test(line)) {
		return null;
	}

	const match = /^([^:/\n]{1,32}):\s+(.*)$/.exec(line);
	if (!match) {
		return null;
	}

	const name = match[1].trim();
	if (name === '' || /^\d+$/.test(name)) {
		return null;
	}

	return { name, content: match[2].trim() };
}

export interface DetectorResult {
	id: string;
	description: string;
	expected: boolean;
	triggered: boolean;
}

export function checkResponse(text: string, expectations: string[]): DetectorResult[] {
	return detectors
		.filter(detector => expectations.includes(detector.id))
		.map(detector => ({
			id: detector.id,
			description: detector.description,
			expected: true,
			triggered: detector.pattern.test(text),
		}));
}

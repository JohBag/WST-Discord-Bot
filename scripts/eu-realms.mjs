// Rebuilds src/features/events/eu-realms.ts from LibRealmInfo.lua, which ships inside the Raid-Helper
// Helper addon (Libs/LibRealmInfo). Usage: node scripts/eu-realms.mjs <path to LibRealmInfo.lua>
import fs from 'node:fs';

const source = process.argv[2];
if (!source) {
	console.error('Usage: node scripts/eu-realms.mjs <path to LibRealmInfo.lua>');
	process.exit(1);
}

// Lines look like [617]="Der Rat von Dalaran,RP,deDE,EU" with an English name fifth when it differs
const realms = new Map();
for (const [, data] of fs.readFileSync(source, 'utf8').matchAll(/^\[\d+\]="([^"]*)"/gm)) {
	const [name, , , region, englishName] = data.split(',');
	if (region === 'EU') {
		realms.set(name, englishName || undefined);
	}
}

const rows = [...realms]
	.sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
	.map(([name, english]) => `\t[${JSON.stringify(name)}${english ? `, ${JSON.stringify(english)}` : ''}],`);

fs.writeFileSync('src/features/events/eu-realms.ts', `// Every EU retail realm, as [name, English name when it differs]. Taken from LibRealmInfo
// (zlib licence, by Phanx), the realm list the Raid-Helper Helper addon checks imported names
// against: a realm it doesn't know is skipped when inviting, so sign-ups use the same list.
// Regenerate with scripts/eu-realms.mjs when Blizzard adds realms.

export const euRealms: [string, string?][] = [
${rows.join('\n')}
];
`);
console.log(`Wrote ${rows.length} EU realms`);

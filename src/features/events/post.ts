import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { APIEmbedField } from 'discord.js';
import { gameName, realmKey } from './characters.js';
import { findSpec, signupRoleOf, signupRoles, signupRolesOf } from './games.js';
import type { SignupRole } from './games.js';
import type { RaidEvent, Signup, SignupStatus } from './store.js';

// IDs are event:<event ID>:<action>
export const eventPrefix = 'event:';

export const roleHeadings: Record<SignupRole, { emoji: string; label: string }> = {
	Tank: { emoji: '🛡️', label: 'Tanks' },
	Healer: { emoji: '💚', label: 'Healers' },
	DPS: { emoji: '⚔️', label: 'DPS' },
};

const listedStatuses: { status: SignupStatus; emoji: string; label: string }[] = [
	{ status: 'tentative', emoji: '❔', label: 'Tentative' },
	{ status: 'absence', emoji: '🚫', label: 'Absent' },
];

const colors = { retail: 0xF1C40F, forever: 0x9B59B6, closed: 0x95A5A6, cancelled: 0x992D22 };

// Discord's embed limits: 6000 characters in all, 1024 per field, 25 fields
const maxTotal = 6000;
const maxField = 1024;
const maxFields = 25;
const blank = '​';

export interface PostContext {
	// The class icon as a Discord emoji, or '' while it isn't uploaded
	classEmoji: (classId: string) => string;
}

function byNumber(a: Signup, b: Signup): number {
	return a.number - b.number;
}

// The number shown on the post: each answer's place in answering order, counting only the answers
// on the post now, so someone who withdrew doesn't leave a gap
function positions(event: RaidEvent): (signup: Signup) => number {
	const order = new Map([...event.signups].sort(byNumber).map((s, i) => [s.userId, i + 1]));
	return signup => order.get(signup.userId) ?? 0;
}

// The number in a monospace code span, padded with non-breaking spaces (Discord drops a plain
// leading space) to the widest number on the post, so the icons after it line up
function numberTag(position: number, width: number): string {
	return `\`${String(position).padStart(width, ' ')}\``;
}

// The first word, without case or accents, split at anything that isn't a letter: "Goatfan | Dave",
// "Goatfan|Dave" and "Zhartogar 😈" give goatfan and zhartogar
function firstWord(name: string): string {
	return name.split(/[^\p{L}\p{M}]+/u).map(realmKey).find(Boolean) ?? '';
}

// The member's name only adds something when it isn't the character's name again. One may be
// short for the other (Lath for Laththuzad) at 4 letters or more, so a 3-letter nickname like Art
// still shows on an alt called Arthas
function memberAddsToName(characterName: string, displayName: string): boolean {
	const [a, b] = [firstWord(characterName), firstWord(displayName)].sort((x, y) => x.length - y.length);
	if (!a) {
		return true;
	}
	return a !== b && (a.length < 4 || !b.startsWith(a));
}

function rosterLine(event: RaidEvent, signup: Signup, number: string, context: PostContext, withMember: boolean): string {
	const character = signup.character!;
	const offSpec = character.offSpecId ? findSpec(event.game, character.classId, character.offSpecId) : undefined;
	// Number first on every line, as below the roster, so the numbers stay in one column. No realm
	// and no spec: the class icon and the role heading say enough, and My sign-up has the rest
	const parts = [number, context.classEmoji(character.classId), `**${character.name}**`];
	// Only the roles the off-spec adds: a Balance druid with Feral off-spec shows the tank shield
	const extra = offSpec ? signupRolesOf(offSpec).filter(role => role !== signupRoleOf(character.role)) : [];
	if (extra.length > 0) {
		parts.push(`(${extra.map(role => roleHeadings[role].emoji).join('')})`);
	}
	if (signup.status === 'late') {
		parts.push('(late)');
	}
	if (withMember && memberAddsToName(character.name, signup.displayName)) {
		parts.push(signup.displayName);
	}
	return parts.filter(Boolean).join(' ');
}

// Under the roster: number, class icon and character, or the member when there's no character
function listedName(signup: Signup, number: string, context: PostContext): string {
	const who = signup.character ? [context.classEmoji(signup.character.classId), signup.character.name] : [signup.displayName];
	return [number, ...who].filter(Boolean).join(' ');
}

// Lines into as many fields as they need, the first under the heading, the rest untitled
function linesToFields(heading: string, lines: string[], separator = '\n'): APIEmbedField[] {
	const fields: APIEmbedField[] = [];
	let value = '';
	for (const line of lines) {
		if (value && value.length + separator.length + line.length > maxField) {
			fields.push({ name: fields.length === 0 ? heading : blank, value });
			value = '';
		}
		value = value ? value + separator + line : line;
	}
	fields.push({ name: fields.length === 0 ? heading : blank, value: value || blank });
	return fields;
}

interface Section {
	heading: string;
	lines: string[];
	separator: string;
}

function sections(event: RaidEvent, context: PostContext, withMember: boolean): Section[] {
	const inRoster = event.signups.filter(s => s.status === 'signed' || s.status === 'late').sort(byNumber);
	const position = positions(event);
	const width = String(event.signups.length).length;
	// Padded only where the lines stack: the comma lists below have no column to line up with
	const number = (signup: Signup) => numberTag(position(signup), width);
	const plainNumber = (signup: Signup) => numberTag(position(signup), 0);
	const result: Section[] = [];
	if (event.kind === 'raid') {
		for (const role of signupRoles) {
			const members = inRoster.filter(s => s.character && signupRoleOf(s.character.role) === role);
			const { emoji, label } = roleHeadings[role];
			result.push({
				heading: `${emoji} ${label} ${members.length}`,
				lines: members.map(s => rosterLine(event, s, number(s), context, withMember)),
				separator: '\n',
			});
		}
	} else {
		result.push({ heading: `✅ Attending ${inRoster.length}`, lines: inRoster.map(s => `${number(s)} ${s.displayName}`), separator: '\n' });
	}
	for (const { status, emoji, label } of listedStatuses) {
		const members = event.signups.filter(s => s.status === status).sort(byNumber);
		if (members.length > 0) {
			result.push({ heading: `${emoji} ${label} ${members.length}`, lines: members.map(s => listedName(s, plainNumber(s), context)), separator: ', ' });
		}
	}
	return result;
}

function size(fields: APIEmbedField[]): number {
	return fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0);
}

// Keeps the first lines of each section that fit, and says how many more there are
function trimmed(list: Section[], room: number): APIEmbedField[] {
	const total = list.reduce((sum, s) => sum + s.lines.length, 0);
	for (let keep = Math.max(...list.map(s => s.lines.length)); keep >= 0; keep--) {
		const fields = list.flatMap(s => {
			const shown = s.lines.slice(0, keep);
			if (shown.length < s.lines.length) {
				shown.push(`+${s.lines.length - shown.length} more`);
			}
			return linesToFields(s.heading, shown, s.separator);
		});
		if (size(fields) <= room && fields.length <= maxFields) {
			return fields;
		}
	}
	return [{ name: blank, value: `${total} answers` }];
}

export function buildPostEmbed(event: RaidEvent, context: PostContext): EmbedBuilder {
	const start = Math.floor(event.start / 1000);
	const inRoster = event.signups.filter(s => s.status === 'signed' || s.status === 'late').length;
	const header: string[] = [];
	if (event.description) {
		header.push(event.description, '');
	}
	if (event.cancelled) {
		header.push('**Cancelled**', '');
	} else if (event.closed) {
		header.push('**Sign-ups closed**', '');
	}
	// The leader is in the footer, so the top is only what everyone checks
	header.push(`<t:${start}:F> (<t:${start}:R>)`);
	if (event.logUrl) {
		header.push(`[Warcraft Logs](${event.logUrl})`);
	}
	// An event's Attending list already gives the count
	if (event.kind === 'raid') {
		header.push(`${inRoster} signed up`);
	}
	const description = header.join('\n');
	const footer = `${gameName(event.game)} ${event.kind} led by ${event.leaderName}`;
	const room = maxTotal - event.title.length - description.length - footer.length;

	// The member names go first if a full raid runs out of room, then lines from the end of each list
	let fields = sections(event, context, true).flatMap(s => linesToFields(s.heading, s.lines, s.separator));
	if (size(fields) > room || fields.length > maxFields) {
		fields = trimmed(sections(event, context, false), room);
	}

	return new EmbedBuilder()
		.setColor(event.cancelled ? colors.cancelled : event.closed ? colors.closed : colors[event.game])
		.setTitle(event.title)
		.setDescription(description)
		.addFields(fields)
		.setFooter({ text: footer });
}

function button(event: RaidEvent, action: string, label: string, style = ButtonStyle.Secondary): ButtonBuilder {
	return new ButtonBuilder().setCustomId(`${eventPrefix}${event.id}:${action}`).setLabel(label).setStyle(style);
}

// A cancelled event keeps its post but loses its buttons. A closed one keeps only Manage. My sign-up
// is a raid's private view for switching character, spec or role
export function buildPostButtons(event: RaidEvent): ActionRowBuilder<ButtonBuilder>[] {
	if (event.cancelled) {
		return [];
	}
	const answers = event.kind === 'raid'
		? [
			button(event, 'signed', 'Sign up', ButtonStyle.Success),
			button(event, 'late', 'Late'),
			button(event, 'tentative', 'Tentative'),
			button(event, 'absence', 'Absent'),
		]
		: [
			button(event, 'signed', 'Attending', ButtonStyle.Success),
			button(event, 'tentative', 'Tentative'),
			button(event, 'absence', 'Absent'),
		];
	const second = [button(event, 'withdraw', 'Withdraw')];
	if (event.kind === 'raid') {
		second.push(button(event, 'mine', 'My sign-up'));
	}
	for (const b of [...answers, ...second]) {
		b.setDisabled(event.closed);
	}
	second.push(button(event, 'manage', 'Manage').setEmoji('⚙️'));
	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(...answers),
		new ActionRowBuilder<ButtonBuilder>().addComponents(...second),
	];
}

export function buildPost(event: RaidEvent, context: PostContext) {
	return { embeds: [buildPostEmbed(event, context)], components: buildPostButtons(event), allowedMentions: { parse: [] as [] } };
}

import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	LabelBuilder,
	PermissionFlagsBits,
	MessageFlags,
	ModalBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import type {
	ButtonInteraction,
	ChatInputCommandInteraction,
	Client,
	MessageActionRowComponentBuilder,
	ModalSubmitInteraction,
	StringSelectMenuInteraction,
} from 'discord.js';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import { buildCharacterPanel, homeRealm, setSignupHook } from './character-panel.js';
import { characterName, charactersOf, gameName, loadCharacters } from './characters.js';
import type { Character } from './characters.js';
import { addMissingEntries, syncCalendar } from './calendar.js';
import { reminderLead, sendReminders } from './reminders.js';
import { createSeries, loadSeries, postDueWeeks, saveSeries, shiftLike } from './series.js';
import type { Series } from './series.js';
import { catchUpInterest } from './interest.js';
import { getClassEmoji } from './emoji.js';
import { exportText, rosterSize } from './export.js';
import { findClass, findSpec, isGameId } from './games.js';
import { signupRoleOf, signupRolesOf } from './games.js';
import type { GameId, SignupRole } from './games.js';
import { buildPost, eventPrefix } from './post.js';
import { answerClickWithin, queueClick, queueEdit } from './post-queue.js';
import { choiceValue, createEvent, findChoice, lastRole, loadEvents, respond, saveEvents, signupChoices, withdraw } from './store.js';
import type { EventKind, EventStore, RaidEvent, Signup, SignupChoice, SignupStatus } from './store.js';
import { formatWhen, parseWhen } from './when.js';

type ComponentInteraction = ButtonInteraction | StringSelectMenuInteraction;
type AnyInteraction = ComponentInteraction | ModalSubmitInteraction;

const answerStatuses: SignupStatus[] = ['signed', 'late', 'tentative', 'absence'];
// Answers that put a character on the post. Absent and plain events don't need one
const characterStatuses: SignupStatus[] = ['signed', 'late', 'tentative'];

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
	return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components);
}

function button(id: string, label: string, style = ButtonStyle.Secondary): ButtonBuilder {
	return new ButtonBuilder().setCustomId(eventPrefix + id).setLabel(label).setStyle(style);
}

function isOfficer(interaction: AnyInteraction | ChatInputCommandInteraction): boolean {
	return interaction.inCachedGuild() && interaction.member.roles.cache.has(config.roles.officer);
}

// The member's name in this server, saved with what they do
function displayNameOf(interaction: AnyInteraction | ChatInputCommandInteraction): string {
	return (interaction.inCachedGuild() ? interaction.member.displayName : undefined) ?? interaction.user.globalName ?? interaction.user.username;
}

function render(event: RaidEvent) {
	return buildPost(event, { classEmoji: getClassEmoji });
}

// Edits the post as a message, in turn with every other redraw (post-queue.ts)
export function updatePost(client: Client, eventId: string): Promise<void> {
	return queueEdit(eventId, async () => {
		try {
			const event = loadEvents()[eventId];
			if (!event?.messageId) {
				return;
			}
			const channel = await client.channels.fetch(event.channelId);
			if (channel?.isTextBased()) {
				await channel.messages.edit(event.messageId, render(event));
			}
		} catch (error) {
			log.error(`Failed to update the post for event ${eventId}: ${error}`);
		}
	});
}

// A click on the post redraws it through its own reply, in turn with every other redraw, from the
// state saved when its turn comes. The answer is saved by then, so if the reply fails the post is
// edited as a message instead. The error isn't passed on: after an early answer, an error reply
// would replace the post itself
async function redrawAfterClick(interaction: ButtonInteraction, eventId: string): Promise<void> {
	const latest = () => {
		const event = loadEvents()[eventId];
		return event ? render(event) : undefined;
	};
	// Discord's deadline counts from the click, not from when it reached the bot
	const elapsed = Math.max(0, Date.now() - interaction.createdTimestamp);
	try {
		await queueClick(eventId, {
			update: () => {
				const post = latest();
				return post ? interaction.update(post) : interaction.deferUpdate();
			},
			answer: () => interaction.deferUpdate(),
			redrawAnswered: async () => {
				const post = latest();
				if (post) {
					await interaction.editReply(post);
				}
			},
		}, Math.max(0, answerClickWithin - elapsed));
	} catch (error) {
		log.error(`Failed to redraw the post for event ${eventId} through a click: ${error}`);
		await updatePost(interaction.client, eventId);
	}
}

// ---- Creating and editing ----

export interface EventFormValues {
	title: string;
	when: string;
	description: string;
	// Only when creating: post it again every week, and whether to remind
	weekly?: boolean;
	noReminder?: boolean;
	// Only when editing a week of a repeating raid: also change the later weeks
	allWeeks?: boolean;
}

// The last turned-down event form per officer, one for creating and one per event edited, so Try
// again opens the right form filled in
const drafts = new Map<string, { game: GameId; kind: EventKind; editId?: string; values: EventFormValues }>();
const draftKey = (userId: string, editId?: string) => `${userId}:${editId ?? 'new'}`;

// repeating: editing a week of a repeating raid, which can also change the later weeks
export function buildEventModal(game: GameId, kind: EventKind, { existing, values, repeating }: { existing?: RaidEvent; values?: EventFormValues; repeating?: boolean } = {}): ModalBuilder {
	const filled: Partial<EventFormValues> = values ?? (existing
		? {
			title: existing.title,
			when: formatWhen(existing.start),
			description: existing.description,
		}
		: {});
	const title = new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true);
	const when = new TextInputBuilder().setCustomId('when').setStyle(TextInputStyle.Short).setMaxLength(40).setRequired(true)
		.setPlaceholder('Wed 19:30 or 26/11 19:30');
	const description = new TextInputBuilder().setCustomId('description').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false);
	if (filled.title) {
		title.setValue(filled.title);
	}
	if (filled.when) {
		when.setValue(filled.when);
	}
	if (filled.description) {
		description.setValue(filled.description);
	}

	const fields = [
		new LabelBuilder().setLabel('Title').setTextInputComponent(title),
		new LabelBuilder().setLabel('Start').setDescription('Server time (Central European)').setTextInputComponent(when),
	];
	// An edit changes that one post. A repeating series is set up when creating, and stopped in Manage.
	// Above the description, which can be tall enough to push it out of sight
	if (!existing) {
		fields.push(new LabelBuilder().setLabel('Repeat').setStringSelectMenuComponent(new StringSelectMenuBuilder()
			.setCustomId('repeat')
			.addOptions(
				{ label: "Doesn't repeat", value: 'once', default: !filled.weekly },
				{ label: 'Every week', description: "Each week's post goes up a week before it starts", value: 'weekly', default: !!filled.weekly },
			)));
	}
	if (existing && repeating) {
		fields.push(new LabelBuilder().setLabel('Apply to').setStringSelectMenuComponent(new StringSelectMenuBuilder()
			.setCustomId('apply-to')
			.addOptions(
				{ label: 'This event', value: 'this', default: !filled.allWeeks },
				{ label: 'This and repeating events', value: 'all', default: !!filled.allWeeks },
			)));
	}
	// Switched later in Manage
	if (!existing) {
		fields.push(new LabelBuilder().setLabel('Reminder').setStringSelectMenuComponent(new StringSelectMenuBuilder()
			.setCustomId('reminder')
			.addOptions(
				{ label: `Ping ${reminderLead()} before`, description: 'Everyone signed up, Late or Tentative', value: 'on', default: !filled.noReminder },
				{ label: 'No reminder', value: 'off', default: !!filled.noReminder },
			)));
	}
	fields.push(new LabelBuilder().setLabel('Description').setTextInputComponent(description));
	return new ModalBuilder()
		.setCustomId(existing ? `${eventPrefix}${existing.id}:save` : `${eventPrefix}new:${game}:${kind}`)
		.setTitle(existing ? `Edit ${existing.title}`.slice(0, 45) : `New ${gameName(game)} ${kind}`)
		.addLabelComponents(...fields);
}

function formValues(interaction: ModalSubmitInteraction): EventFormValues {
	const repeat = interaction.fields.fields.has('repeat') ? interaction.fields.getStringSelectValues('repeat')[0] : undefined;
	return {
		title: interaction.fields.getTextInputValue('title').trim(),
		when: interaction.fields.getTextInputValue('when'),
		description: interaction.fields.getTextInputValue('description').trim(),
		weekly: repeat === 'weekly',
		noReminder: interaction.fields.fields.has('reminder') && interaction.fields.getStringSelectValues('reminder')[0] === 'off',
		allWeeks: interaction.fields.fields.has('apply-to') && interaction.fields.getStringSelectValues('apply-to')[0] === 'all',
	};
}

// Sends an event's post, saves the event and adds its Events tab entry. Returns the post's link and,
// when the Events tab failed, a line saying so. Throws when the post couldn't be sent
export async function postEvent(client: Client, event: RaidEvent): Promise<{ url: string; problem?: string }> {
	const channel = await client.channels.fetch(event.channelId);
	if (!channel?.isSendable()) {
		throw new Error(`can't post in channel ${event.channelId}`);
	}
	const message = await channel.send(render(event));
	event.messageId = message.id;
	const store = loadEvents();
	store[event.id] = event;
	saveEvents(store);
	const problem = await syncCalendar(client, event);
	return { url: message.url, problem };
}

// /event create: officers only, opens the form
export async function openCreateForm(interaction: ChatInputCommandInteraction): Promise<void> {
	const game = interaction.options.getString('game', true);
	const kind = (interaction.options.getString('type') ?? 'raid') as EventKind;
	if (!isOfficer(interaction)) {
		await interaction.reply({ content: 'Only officers can create events.', flags: MessageFlags.Ephemeral });
		return;
	}
	if (!isGameId(game)) {
		return;
	}
	await interaction.showModal(buildEventModal(game, kind));
}

function rejected(notice: string, editId?: string) {
	return {
		content: notice,
		embeds: [],
		components: [row(button(`draft:retry:${editId ?? 'new'}`, 'Try again', ButtonStyle.Primary))],
	};
}

async function createFromForm(interaction: ModalSubmitInteraction, game: GameId, kind: EventKind): Promise<void> {
	// Answered first: posting can take longer than Discord waits for an answer. From a Try again
	// message, that message is the one updated
	if (interaction.isFromMessage()) {
		await interaction.deferUpdate();
	} else {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	}
	const values = formValues(interaction);
	const start = parseWhen(values.when);
	if (typeof start !== 'number') {
		drafts.set(draftKey(interaction.user.id), { game, kind, values });
		await interaction.editReply(rejected(start.error));
		return;
	}
	// The post goes where the command was used (decided 2026-11-16)
	const channelId = interaction.channelId!;
	const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
	const where = 'this channel';
	const me = interaction.client.user;
	const canPost = !!channel && channel.isTextBased() && 'send' in channel && (!('permissionsFor' in channel)
		|| !!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]));
	if (!canPost) {
		drafts.set(draftKey(interaction.user.id), { game, kind, values });
		await interaction.editReply(rejected(`I can't post in ${where}. I need to see it, send messages and embed links there.`));
		return;
	}
	const event = createEvent({
		game,
		kind,
		title: values.title,
		description: values.description,
		start,
		leaderId: interaction.user.id,
		leaderName: displayNameOf(interaction),
		channelId,
		guildId: interaction.guildId ?? undefined,
	});
	if (values.noReminder) {
		event.noReminder = true;
	}
	if (values.weekly) {
		const series = createSeries(event);
		event.seriesId = series.id;
		const all = loadSeries();
		all[series.id] = series;
		saveSeries(all);
	}
	let posted;
	try {
		posted = await postEvent(interaction.client, event);
	} catch (error) {
		log.error(`Failed to post ${event.title}: ${error}`);
		if (event.seriesId) {
			const all = loadSeries();
			delete all[event.seriesId];
			saveSeries(all);
		}
		drafts.set(draftKey(interaction.user.id), { game, kind, values });
		await interaction.editReply(rejected(`Posting in ${where} failed.`));
		return;
	}
	drafts.delete(draftKey(interaction.user.id));
	log(`${interaction.user.username} created ${gameName(game)} ${kind} ${event.title}${values.weekly ? ', every week' : ''}`);
	const lines = [`Posted: ${posted.url}`, values.weekly ? "Next week's goes up a week before it starts." : undefined, posted.problem];
	await interaction.editReply({ content: lines.filter(Boolean).join('\n'), components: [] });
}

// Keeps the Events tab entry in step after an officer's change, and tells them if that failed
async function syncAndReport(interaction: AnyInteraction, event: RaidEvent): Promise<void> {
	const problem = await syncCalendar(interaction.client, event);
	if (problem) {
		await interaction.followUp({ content: problem, flags: MessageFlags.Ephemeral }).catch(() => {});
	}
}

// ---- The officers' Manage panel ----

function managePanel(event: RaidEvent, notice?: string) {
	const start = Math.floor(event.start / 1000);
	const lines = [notice, `**${event.title}**`, `<t:${start}:F>`].filter(Boolean);
	if (event.cancelled) {
		return { content: [...lines, 'Cancelled.'].join('\n'), embeds: [], components: [] };
	}
	const buttons = [
		button(`${event.id}:edit`, 'Edit', ButtonStyle.Primary),
		event.closed ? button(`${event.id}:reopen`, 'Open sign-ups') : button(`${event.id}:close`, 'Close sign-ups'),
	];
	// Raids only: an event has no characters to invite
	if (event.kind === 'raid') {
		buttons.push(button(`${event.id}:export`, 'Export'));
	}
	buttons.push(button(`${event.id}:cancel`, 'Cancel event', ButtonStyle.Danger));
	// A second row, since a row holds five
	const more = [event.noReminder
		? button(`${event.id}:reminder-on`, 'Turn reminder on')
		: button(`${event.id}:reminder-off`, 'Turn reminder off')];
	lines.push(event.noReminder ? 'Reminder: off' : `Reminder: ${reminderLead()} before`);
	const repeating = !!event.seriesId && !!loadSeries()[event.seriesId]?.active;
	if (repeating) {
		lines.push('Repeats every week.');
		more.push(button(`${event.id}:stop-repeat`, 'Stop repeating'));
	}
	return { content: lines.join('\n'), embeds: [], components: [row(...buttons), row(...more)] };
}

// A text box holds 4000 characters. A full 40-player raid takes about 3000
const maxCopyBox = 4000;

// The export in a form, to copy. The form's own Submit just closes it
export function buildExportModal(event: RaidEvent, text: string): ModalBuilder {
	const box = new TextInputBuilder()
		.setCustomId('export')
		.setStyle(TextInputStyle.Paragraph)
		.setValue(text)
		.setRequired(false);
	const retail = event.game === 'retail';
	return new ModalBuilder()
		.setCustomId(`${eventPrefix}${event.id}:export-done`)
		.setTitle(retail ? 'Export for Raid-Helper Helper' : 'Names to invite')
		.addLabelComponents(new LabelBuilder()
			.setLabel(`${rosterSize(event)} to invite`)
			.setDescription(retail ? 'Ctrl+A, Ctrl+C, then paste into /rhh in game' : 'Ctrl+A, Ctrl+C, then invite them in game')
			.setTextInputComponent(box));
}

function confirmCancel(event: RaidEvent) {
	return {
		content: `Cancel **${event.title}**? The post stays, marked cancelled, without buttons.`,
		embeds: [],
		components: [row(
			button(`${event.id}:cancel-yes`, 'Cancel event', ButtonStyle.Danger),
			button(`${event.id}:manage-back`, 'Keep it'),
		)],
	};
}

async function saveFromForm(interaction: ModalSubmitInteraction, eventId: string): Promise<void> {
	const store = loadEvents();
	const event = store[eventId];
	if (!event || event.cancelled) {
		await show(interaction, { content: event ? 'This event was cancelled.' : 'This event no longer exists.', components: [] });
		return;
	}
	const values = formValues(interaction);
	// An unchanged start is kept even when it has passed, so a started raid can still be edited
	let start = event.start;
	if (values.when.trim() !== formatWhen(event.start)) {
		const parsed = parseWhen(values.when);
		if (typeof parsed !== 'number') {
			drafts.set(draftKey(interaction.user.id, event.id), { game: event.game, kind: event.kind, editId: event.id, values });
			await show(interaction, rejected(parsed.error, event.id));
			return;
		}
		start = parsed;
		// A new start gets its own reminder
		event.reminded = false;
		// Moved to later: sign-ups closed by the start open again, ones an officer closed stay closed
		event.autoClosed = false;
		if (event.closedBy === 'start') {
			event.closed = false;
			event.closedBy = undefined;
		}
	}
	const oldStart = event.start;
	event.title = values.title;
	event.description = values.description;
	event.start = start;
	let later: RaidEvent[] = [];
	if (values.allWeeks && event.seriesId) {
		const all = loadSeries();
		later = applyToLaterWeeks(store, event, oldStart, all[event.seriesId]);
		saveSeries(all);
	}
	drafts.delete(draftKey(interaction.user.id, event.id));
	saveEvents(store);
	log(`${interaction.user.username} edited ${event.title}${values.allWeeks ? ' and its later weeks' : ''}`);
	await show(interaction, managePanel(event, values.allWeeks ? 'Saved for this and later weeks.' : 'Saved.'));
	await updatePost(interaction.client, event.id);
	await syncAndReport(interaction, event);
	let laterProblem: string | undefined;
	for (const other of later) {
		await updatePost(interaction.client, other.id);
		laterProblem ??= await syncCalendar(interaction.client, other);
	}
	if (laterProblem) {
		await interaction.followUp({ content: `Later weeks: ${laterProblem}`, flags: MessageFlags.Ephemeral }).catch(() => {});
	}
}

// "This and repeating events": the later weeks already posted and the series, for the weeks still to
// be posted, take the new title and description, and move the way this week moved. Earlier weeks
// stay. Changes the store and series given, and returns the later weeks changed
export function applyToLaterWeeks(store: EventStore, event: RaidEvent, oldStart: number, series: Series | undefined, now = Date.now()): RaidEvent[] {
	const moved = event.start !== oldStart;
	const later = Object.values(store).filter(other => other.seriesId === event.seriesId && other.id !== event.id && !other.cancelled && other.start > oldStart);
	for (const other of later) {
		other.title = event.title;
		other.description = event.description;
		// A week that has already begun keeps its time
		if (moved && other.start > now) {
			other.start = shiftLike(other.start, oldStart, event.start);
			other.reminded = false;
		}
	}
	if (series) {
		series.title = event.title;
		series.description = event.description;
		if (moved) {
			series.lastStart = shiftLike(series.lastStart, oldStart, event.start);
		}
	}
	return later;
}

async function show(interaction: AnyInteraction, content: object): Promise<void> {
	if (interaction.isModalSubmit() && !interaction.isFromMessage()) {
		await interaction.reply({ embeds: [], ...content, flags: MessageFlags.Ephemeral });
		return;
	}
	await (interaction as ComponentInteraction).update({ embeds: [], ...content });
}

// ---- Signing up ----

// The same words as the buttons
const statusLabel: Record<SignupStatus, string> = {
	signed: 'Signed up',
	late: 'Late',
	tentative: 'Tentative',
	absence: 'Absent',
};

function describeCharacter(game: GameId, character: { name: string; realm: string; classId: string }, specId: string, role?: SignupRole): string {
	const spec = findSpec(game, character.classId, specId);
	const what = `**${characterName(character, homeRealm(game))}**, ${spec?.name ?? '?'} ${findClass(game, character.classId)?.name ?? '?'}`;
	return role ? `${what} (${role})` : what;
}

// My sign-up: what they're signed up as, and a menu to switch character, spec or role. Not signed up
// yet, the menu signs them up
export function signupReply(event: RaidEvent, signup: Signup | undefined, characters: Character[], userId: string) {
	const role = signup?.character ? signupRoleOf(signup.character.role) : undefined;
	const content = !signup
		? (characters.length > 0 ? 'Not signed up. Pick a character to sign up with.' : `Not signed up, and no ${gameName(event.game)} character saved yet.`)
		: signup.character
			? `${statusLabel[signup.status]}: ${describeCharacter(event.game, signup.character, signup.character.specId, role)}`
			: statusLabel[signup.status];
	const choices = signupChoices(characters);
	const current = signup?.character ? `${signup.character.id}|${signup.character.specId}|${role}` : '';
	const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
	if (choices.some(choice => choiceValue(choice) !== current)) {
		components.push(row(new StringSelectMenuBuilder()
			.setCustomId(`${eventPrefix}${event.id}:choose`)
			.setPlaceholder(signup ? 'Switch character or spec' : 'Pick a character')
			.addOptions(choices.map(choice => ({
				label: `${characterName(choice.character, homeRealm(event.game))}: ${findSpec(event.game, choice.character.classId, choice.specId)?.name ?? '?'} (${choice.role})`.slice(0, 100),
				description: findClass(event.game, choice.character.classId)?.name,
				value: choiceValue(choice),
				default: choiceValue(choice) === current,
			})))));
	}
	components.push(row(new ButtonBuilder().setCustomId(`characters:${userId}:home`).setLabel('My characters').setStyle(ButtonStyle.Secondary)));
	return { content, embeds: [], components, allowedMentions: { parse: [] as [] } };
}

// For a spec that fills two roles and hasn't been signed up with before: which role
export function roleQuestion(event: RaidEvent, status: SignupStatus, character: Character, specId: string, roles: SignupRole[]) {
	return {
		content: `${describeCharacter(event.game, character, specId)}: which role?`,
		embeds: [],
		components: [row(...roles.map(role => button(`${event.id}:role:${status}:${character.id}:${specId}:${role}`, role, ButtonStyle.Primary)))],
		allowedMentions: { parse: [] as [] },
	};
}

// The class picker for a member with no character for the game. The character panel signs them up
// once it's saved
function addCharacterFirst(event: RaidEvent, userId: string, status: SignupStatus) {
	return buildCharacterPanel(loadCharacters(), userId, {
		kind: 'pick-class',
		game: event.game,
		then: `${event.id}/${status}`,
		notice: `Add your ${gameName(event.game)} character first. You're signed up as soon as it's saved.`,
	});
}

type Pick = { choice: SignupChoice } | { ask: { character: Character; specId: string; roles: SignupRole[] } };

// A character's own spec, in the role it last signed up as. A two-role spec it never signed up with
// asks. From the given character, else the main
function pickFor(store: EventStore, userId: string, characters: Character[], character = characters.find(c => c.main) ?? characters[0]): Pick | undefined {
	if (!character) {
		return undefined;
	}
	const spec = findSpec(character.game, character.classId, character.specId);
	if (!spec) {
		// A saved spec the game data no longer has: any spec of theirs rather than none
		const fallback = signupChoices(characters)[0];
		return fallback ? { choice: fallback } : undefined;
	}
	const roles = signupRolesOf(spec);
	if (roles.length > 1) {
		const role = lastRole(store, userId, character.id, spec.id);
		if (!role) {
			return { ask: { character, specId: spec.id, roles } };
		}
		return { choice: { character, specId: spec.id, role } };
	}
	return { choice: { character, specId: spec.id, role: roles[0] } };
}

// Late is a toggle: clicking it again while late signs them up on time, keeping their number
export function clickedStatus(event: RaidEvent, userId: string, clicked: SignupStatus): SignupStatus {
	const current = event.signups.find(s => s.userId === userId)?.status;
	return clicked === 'late' && current === 'late' ? 'signed' : clicked;
}

async function answer(interaction: ButtonInteraction, store: EventStore, event: RaidEvent, clicked: SignupStatus): Promise<void> {
	const userId = interaction.user.id;
	const name = displayNameOf(interaction);
	const status = clickedStatus(event, userId, clicked);

	// No character needed: the post itself shows the answer, updated through the click
	if (event.kind === 'event' || !characterStatuses.includes(status)) {
		respond(event, userId, name, status);
		saveEvents(store);
		await redrawAfterClick(interaction, event.id);
		return;
	}

	// An earlier sign-up keeps its character when only the status changes
	const existing = event.signups.find(s => s.userId === userId);
	if (existing?.character) {
		respond(event, userId, name, status);
		saveEvents(store);
		await redrawAfterClick(interaction, event.id);
		return;
	}

	const characters = charactersOf(loadCharacters(), userId, event.game);
	const pick = pickFor(store, userId, characters);
	if (!pick) {
		await interaction.reply({ ...addCharacterFirst(event, userId, status), flags: MessageFlags.Ephemeral });
		return;
	}
	if ('ask' in pick) {
		await interaction.reply({ ...roleQuestion(event, status, pick.ask.character, pick.ask.specId, pick.ask.roles), flags: MessageFlags.Ephemeral });
		return;
	}
	// The post shows the answer. My sign-up switches character, spec or role
	respond(event, userId, name, status, pick.choice);
	saveEvents(store);
	await redrawAfterClick(interaction, event.id);
}

// After a character was added from a sign-up: sign up with it and answer in the same private message
setSignupHook(async (interaction, then, character) => {
	const [eventId, status] = then.split('/') as [string, SignupStatus];
	const store = loadEvents();
	const event = store[eventId];
	const closed = !event ? 'That event no longer exists.' : event.cancelled ? 'That event was cancelled.' : event.closed ? 'Sign-ups for that event are closed.' : undefined;
	if (closed || !answerStatuses.includes(status)) {
		await show(interaction, { content: `Saved ${character.name}. ${closed ?? ''}`.trim(), components: [] });
		return;
	}
	const pick = pickFor(store, interaction.user.id, [character], character)!;
	if ('ask' in pick) {
		await show(interaction, roleQuestion(event!, status, character, pick.ask.specId, pick.ask.roles));
		return;
	}
	const signup = respond(event!, interaction.user.id, displayNameOf(interaction), status, pick.choice);
	saveEvents(store);
	await show(interaction, signupReply(event!, signup, charactersOf(loadCharacters(), interaction.user.id, event!.game), interaction.user.id));
	await updatePost(interaction.client, event!.id);
});

// ---- Routing ----

export async function handleEventInteraction(interaction: AnyInteraction): Promise<void> {
	const [eventId, parsedAction, ...args] = interaction.customId.slice(eventPrefix.length).split(':');
	// A Bench button on a post drawn before Bench was dropped counts as Tentative
	const action = parsedAction === 'bench' ? 'tentative' : parsedAction;

	if (interaction.isModalSubmit()) {
		if (!isOfficer(interaction)) {
			await interaction.reply({ content: 'Only officers can create or edit events.', flags: MessageFlags.Ephemeral });
			return;
		}
		if (eventId === 'new' && isGameId(action) && (args[0] === 'raid' || args[0] === 'event')) {
			await createFromForm(interaction, action, args[0]);
		} else if (action === 'export-done') {
			// Submit on the export form only closes it
			await interaction.deferUpdate().catch(() => {});
		} else if (action === 'save') {
			await saveFromForm(interaction, eventId);
		}
		return;
	}

	if (eventId === 'draft' && action === 'retry') {
		const draft = drafts.get(draftKey(interaction.user.id, args[0] === 'new' ? undefined : args[0]));
		const existing = draft?.editId ? loadEvents()[draft.editId] : undefined;
		if (!draft || (draft.editId && !existing)) {
			await interaction.update({ content: 'That form was lost. Start it again.', components: [] });
			return;
		}
		const repeating = !!existing?.seriesId && !!loadSeries()[existing.seriesId]?.active;
		await interaction.showModal(buildEventModal(draft.game, draft.kind, { existing, values: draft.values, repeating }));
		return;
	}

	const store = loadEvents();
	const event = store[eventId];
	if (!event) {
		await interaction.reply({ content: 'This event no longer exists.', flags: MessageFlags.Ephemeral });
		return;
	}

	// Members' answers on the post, and the role buttons and switch menu in their private reply
	if (answerStatuses.includes(action as SignupStatus) || ['withdraw', 'choose', 'role', 'mine'].includes(action)) {
		if (event.cancelled || event.closed) {
			await interaction.reply({ content: event.cancelled ? 'This event was cancelled.' : 'Sign-ups are closed.', flags: MessageFlags.Ephemeral });
			return;
		}
		const userId = interaction.user.id;
		if (action === 'mine') {
			const characters = charactersOf(loadCharacters(), userId, event.game);
			const signup = event.signups.find(s => s.userId === userId);
			if (characters.length === 0 && !signup?.character) {
				// Nothing to switch to: add a character, which signs them up once saved
				await interaction.reply({ ...addCharacterFirst(event, userId, signup?.status ?? 'signed'), flags: MessageFlags.Ephemeral });
				return;
			}
			await interaction.reply({ ...signupReply(event, signup, characters, userId), flags: MessageFlags.Ephemeral });
			return;
		}
		if (action === 'withdraw') {
			if (!withdraw(event, userId)) {
				await interaction.reply({ content: "You're not signed up.", flags: MessageFlags.Ephemeral });
				return;
			}
			saveEvents(store);
			await redrawAfterClick(interaction as ButtonInteraction, event.id);
			return;
		}
		if (action === 'choose' || action === 'role') {
			const characters = charactersOf(loadCharacters(), userId, event.game);
			const raw = action === 'choose' && interaction.isStringSelectMenu() ? interaction.values[0] : args.slice(1).join('|');
			// A menu sent before melee and ranged became DPS still says Melee or Ranged
			const [characterId, specId, role] = raw.split('|');
			const choice = findChoice(characters, `${characterId}|${specId}|${signupRoleOf(role as SignupRole)}`);
			if (!choice) {
				await interaction.update({ content: 'That character is no longer saved.', components: [] });
				return;
			}
			const status = action === 'role'
				? args[0] as SignupStatus
				: event.signups.find(s => s.userId === userId)?.status ?? 'signed';
			const signup = respond(event, userId, displayNameOf(interaction), status, choice);
			saveEvents(store);
			await interaction.update(signupReply(event, signup, characters, userId));
			await updatePost(interaction.client, event.id);
			return;
		}
		if (interaction.isButton()) {
			await answer(interaction, store, event, action as SignupStatus);
		}
		return;
	}

	// Everything else is the officers' Manage panel
	if (!isOfficer(interaction)) {
		await interaction.reply({ content: 'Only officers can manage events.', flags: MessageFlags.Ephemeral });
		return;
	}
	if (event.cancelled && action !== 'manage') {
		await interaction.update(managePanel(event));
		return;
	}
	switch (action) {
		case 'manage':
			await interaction.reply({ ...managePanel(event), flags: MessageFlags.Ephemeral });
			return;
		case 'manage-back':
			await interaction.update(managePanel(event));
			return;
		case 'export': {
			if (rosterSize(event) === 0) {
				await interaction.update(managePanel(event, 'Nobody is signed up yet.'));
				return;
			}
			const text = exportText(event);
			if (text.length > maxCopyBox) {
				// Too long for the box: a file to open and copy from instead
				const retail = event.game === 'retail';
				const file = new AttachmentBuilder(Buffer.from(text, 'utf8'), { name: retail ? 'raid.json' : 'raid.txt' });
				await interaction.reply({
					content: retail ? 'Open the file, copy everything and paste it into /rhh in game.' : 'Open the file for the names to invite.',
					files: [file],
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			await interaction.showModal(buildExportModal(event, text));
			return;
		}
		case 'edit':
			await interaction.showModal(buildEventModal(event.game, event.kind, { existing: event, repeating: !!event.seriesId && !!loadSeries()[event.seriesId]?.active }));
			return;
		case 'close':
		case 'reopen':
			event.closed = action === 'close';
			event.closedBy = event.closed ? 'officer' : undefined;
			saveEvents(store);
			log(`${interaction.user.username} ${action === 'close' ? 'closed' : 'opened'} sign-ups for ${event.title}`);
			await interaction.update(managePanel(event, action === 'close' ? 'Sign-ups closed.' : 'Sign-ups open.'));
			await updatePost(interaction.client, event.id);
			return;
		case 'cancel':
			await interaction.update(confirmCancel(event));
			return;
		case 'reminder-on':
		case 'reminder-off': {
			const off = action === 'reminder-off';
			// On a repeating raid it goes for every week still to come, and the weeks not posted yet
			const now = Date.now();
			for (const other of Object.values(store)) {
				if (other.id === event.id || (event.seriesId && other.seriesId === event.seriesId && other.start > now)) {
					if (off) {
						other.noReminder = true;
					} else {
						delete other.noReminder;
					}
				}
			}
			saveEvents(store);
			const all = loadSeries();
			if (event.seriesId && all[event.seriesId]) {
				if (off) {
					all[event.seriesId].noReminder = true;
				} else {
					delete all[event.seriesId].noReminder;
				}
				saveSeries(all);
			}
			log(`${interaction.user.username} turned the reminder ${off ? 'off' : 'on'} for ${event.title}`);
			await interaction.update(managePanel(event, off ? 'Reminder off.' : 'Reminder on.'));
			return;
		}
		case 'stop-repeat':
			await interaction.update({
				content: `Stop **${event.title}** repeating? No more weeks are posted. Posts already up stay.`,
				embeds: [],
				components: [row(
					button(`${event.id}:stop-repeat-yes`, 'Stop repeating', ButtonStyle.Danger),
					button(`${event.id}:manage-back`, 'Keep it'),
				)],
			});
			return;
		case 'stop-repeat-yes': {
			const all = loadSeries();
			if (event.seriesId && all[event.seriesId]) {
				all[event.seriesId].active = false;
				saveSeries(all);
				log(`${interaction.user.username} stopped ${event.title} repeating`);
			}
			await interaction.update(managePanel(event, 'No more weeks will be posted. Posts already up stay.'));
			return;
		}
		case 'cancel-yes':
			event.cancelled = true;
			saveEvents(store);
			log(`${interaction.user.username} cancelled ${event.title}`);
			await interaction.update(managePanel(event));
			await updatePost(interaction.client, event.id);
			await syncAndReport(interaction, event);
			return;
		default:
			log.warn(`Unknown event action: ${interaction.customId}`);
			await interaction.reply({ content: 'That button is out of date.', flags: MessageFlags.Ephemeral });
	}
}

// ---- Closing at the start ----

export function closeStarted(store: EventStore, now = Date.now()): RaidEvent[] {
	const closed: RaidEvent[] = [];
	for (const event of Object.values(store)) {
		if (!event.cancelled && !event.autoClosed && event.start <= now) {
			event.autoClosed = true;
			if (!event.closed) {
				event.closed = true;
				event.closedBy = 'start';
				closed.push(event);
			}
		}
	}
	return closed;
}

export function startEventTimer(client: Client): void {
	// A tick still waiting on Discord makes the next one skip rather than run alongside it
	let running = false;
	const tick = async () => {
		if (running) {
			return;
		}
		running = true;
		try {
			const store = loadEvents();
			const closed = closeStarted(store);
			if (closed.length > 0) {
				saveEvents(store);
				for (const event of closed) {
					log(`Sign-ups closed for ${event.title} at its start`);
					await updatePost(client, event.id);
				}
			}
			await sendReminders(client);
			await postDueWeeks(client, async (c, event) => (await postEvent(c, event)).url);
		} catch (error) {
			log.error(`Event timer failed: ${error}`);
		} finally {
			running = false;
		}
	};
	void tick();
	setInterval(tick, 60 * 1000);
	void redrawRecent(client).then(() => addMissingEntries(client)).then(() => catchUpInterest(client));
}

// After a restart, posts from the last week and ahead are drawn again, so a change to how posts look
// or which buttons they have reaches the ones already up
async function redrawRecent(client: Client): Promise<void> {
	try {
		const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		for (const event of Object.values(loadEvents())) {
			if (event.start > weekAgo) {
				await updatePost(client, event.id);
			}
		}
	} catch (error) {
		log.error(`Redrawing event posts failed: ${error}`);
	}
}

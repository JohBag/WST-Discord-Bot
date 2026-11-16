import {
	ActionRowBuilder,
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
import { getClassEmoji } from './emoji.js';
import { findClass, findSpec, isGameId } from './games.js';
import type { GameId, Role } from './games.js';
import { buildPost, eventPrefix } from './post.js';
import { choiceValue, createEvent, findChoice, lastRole, loadEvents, respond, saveEvents, signupChoices, withdraw } from './store.js';
import type { EventKind, EventStore, RaidEvent, Signup, SignupChoice, SignupStatus } from './store.js';
import { formatWhen, parseWhen } from './when.js';

type ComponentInteraction = ButtonInteraction | StringSelectMenuInteraction;
type AnyInteraction = ComponentInteraction | ModalSubmitInteraction;

const noTarget = 'none';
const answerStatuses: SignupStatus[] = ['signed', 'late', 'tentative', 'bench', 'absence'];
// Answers that put a character on the post. Absence and plain events don't need one
const characterStatuses: SignupStatus[] = ['signed', 'late', 'tentative', 'bench'];

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
	return buildPost(event, { classEmoji: getClassEmoji, homeRealm: homeRealm(event.game) });
}

// Edits to one post run one at a time and each draws the latest saved state. While one is waiting
// to start, more clicks don't queue more: the waiting one will show them all
const postQueues = new Map<string, { running: Promise<void>; waiting: boolean }>();

export function updatePost(client: Client, eventId: string): Promise<void> {
	const queue = postQueues.get(eventId);
	if (queue?.waiting) {
		return queue.running;
	}
	const entry = { running: Promise.resolve(), waiting: true };
	entry.running = (queue?.running ?? Promise.resolve()).then(async () => {
		entry.waiting = false;
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
	postQueues.set(eventId, entry);
	return entry.running;
}

// ---- Creating and editing ----

export interface EventFormValues {
	title: string;
	when: string;
	description: string;
	tanks?: number;
	healers?: number;
}

// The last turned-down event form per officer, one for creating and one per event edited, so Try
// again opens the right form filled in
const drafts = new Map<string, { game: GameId; kind: EventKind; editId?: string; values: EventFormValues }>();
const draftKey = (userId: string, editId?: string) => `${userId}:${editId ?? 'new'}`;

function targetMenu(id: string, max: number, selected?: number): StringSelectMenuBuilder {
	return new StringSelectMenuBuilder()
		.setCustomId(id)
		.addOptions(
			{ label: 'No target', value: noTarget, default: !selected },
			...Array.from({ length: max }, (_, i) => ({ label: String(i + 1), value: String(i + 1), default: selected === i + 1 })),
		);
}

export function buildEventModal(game: GameId, kind: EventKind, { existing, values }: { existing?: RaidEvent; values?: EventFormValues } = {}): ModalBuilder {
	const filled: Partial<EventFormValues> = values ?? (existing
		? {
			title: existing.title,
			when: formatWhen(existing.start),
			description: existing.description,
			tanks: existing.targets.Tank,
			healers: existing.targets.Healer,
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
		new LabelBuilder().setLabel('Description').setTextInputComponent(description),
	];
	if (kind === 'raid') {
		fields.push(
			new LabelBuilder().setLabel('Tanks needed').setStringSelectMenuComponent(targetMenu('tanks', 5, filled.tanks)),
			new LabelBuilder().setLabel('Healers needed').setStringSelectMenuComponent(targetMenu('healers', 10, filled.healers)),
		);
	}
	return new ModalBuilder()
		.setCustomId(existing ? `${eventPrefix}${existing.id}:save` : `${eventPrefix}new:${game}:${kind}`)
		.setTitle(existing ? `Edit ${existing.title}`.slice(0, 45) : `New ${gameName(game)} ${kind}`)
		.addLabelComponents(...fields);
}

function formValues(interaction: ModalSubmitInteraction, kind: EventKind): EventFormValues {
	const target = (id: string) => {
		const value = interaction.fields.getStringSelectValues(id)[0];
		return value && value !== noTarget ? Number(value) : undefined;
	};
	return {
		title: interaction.fields.getTextInputValue('title').trim(),
		when: interaction.fields.getTextInputValue('when'),
		description: interaction.fields.getTextInputValue('description').trim(),
		...(kind === 'raid' ? { tanks: target('tanks'), healers: target('healers') } : {}),
	};
}

function targetsFrom(values: EventFormValues): Partial<Record<Role, number>> {
	const targets: Partial<Record<Role, number>> = {};
	if (values.tanks) {
		targets.Tank = values.tanks;
	}
	if (values.healers) {
		targets.Healer = values.healers;
	}
	return targets;
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
	const values = formValues(interaction, kind);
	const start = parseWhen(values.when);
	if (typeof start !== 'number') {
		drafts.set(draftKey(interaction.user.id), { game, kind, values });
		await interaction.editReply(rejected(start.error));
		return;
	}
	// The game's channel, or where the command was used while none is set
	const configured = config.events?.channels?.[game];
	const channelId = configured || interaction.channelId!;
	const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
	const where = configured ? `<#${configured}>` : 'this channel';
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
		targets: targetsFrom(values),
	});
	let message;
	try {
		message = await channel.send(render(event));
	} catch (error) {
		log.error(`Failed to post ${event.title}: ${error}`);
		drafts.set(draftKey(interaction.user.id), { game, kind, values });
		await interaction.editReply(rejected(`Posting in ${where} failed.`));
		return;
	}
	drafts.delete(draftKey(interaction.user.id));
	event.messageId = message.id;
	const store = loadEvents();
	store[event.id] = event;
	saveEvents(store);
	log(`${interaction.user.username} created ${gameName(game)} ${kind} ${event.title}`);
	await interaction.editReply({ content: `Posted: ${message.url}`, components: [] });
}

// ---- The officers' Manage panel ----

function managePanel(event: RaidEvent, notice?: string) {
	const start = Math.floor(event.start / 1000);
	const lines = [notice, `**${event.title}**`, `<t:${start}:F>`].filter(Boolean);
	if (event.cancelled) {
		return { content: [...lines, 'Cancelled.'].join('\n'), embeds: [], components: [] };
	}
	return {
		content: lines.join('\n'),
		embeds: [],
		components: [row(
			button(`${event.id}:edit`, 'Edit', ButtonStyle.Primary),
			event.closed ? button(`${event.id}:reopen`, 'Open sign-ups') : button(`${event.id}:close`, 'Close sign-ups'),
			button(`${event.id}:cancel`, 'Cancel event', ButtonStyle.Danger),
		)],
	};
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
	const values = formValues(interaction, event.kind);
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
		// Moved to later: sign-ups closed by the start open again, ones an officer closed stay closed
		event.autoClosed = false;
		if (event.closedBy === 'start') {
			event.closed = false;
			event.closedBy = undefined;
		}
	}
	event.title = values.title;
	event.description = values.description;
	event.start = start;
	event.targets = event.kind === 'raid' ? targetsFrom(values) : {};
	drafts.delete(draftKey(interaction.user.id, event.id));
	saveEvents(store);
	log(`${interaction.user.username} edited ${event.title}`);
	await show(interaction, managePanel(event, 'Saved.'));
	await updatePost(interaction.client, event.id);
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
	bench: 'Bench',
	absence: 'Absence',
};

function describeCharacter(game: GameId, character: { name: string; realm: string; classId: string }, specId: string, role?: Role): string {
	const spec = findSpec(game, character.classId, specId);
	const what = `**${characterName(character, homeRealm(game))}**, ${spec?.name ?? '?'} ${findClass(game, character.classId)?.name ?? '?'}`;
	return role ? `${what} (${role})` : what;
}

// The private reply after an answer: what they're signed up as, and a menu to switch
export function signupReply(event: RaidEvent, signup: Signup, characters: Character[], userId: string) {
	const content = signup.character
		? `${statusLabel[signup.status]}: ${describeCharacter(event.game, signup.character, signup.character.specId, signup.character.role)}`
		: statusLabel[signup.status];
	const choices = signupChoices(characters);
	const current = signup.character ? `${signup.character.id}|${signup.character.specId}|${signup.character.role}` : '';
	const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
	if (choices.some(choice => choiceValue(choice) !== current)) {
		components.push(row(new StringSelectMenuBuilder()
			.setCustomId(`${eventPrefix}${event.id}:choose`)
			.setPlaceholder('Switch character or spec')
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
export function roleQuestion(event: RaidEvent, status: SignupStatus, character: Character, specId: string, roles: Role[]) {
	return {
		content: `${describeCharacter(event.game, character, specId)}: which role?`,
		embeds: [],
		components: [row(...roles.map(role => button(`${event.id}:role:${status}:${character.id}:${specId}:${role}`, role, ButtonStyle.Primary)))],
		allowedMentions: { parse: [] as [] },
	};
}

type Pick = { choice: SignupChoice } | { ask: { character: Character; specId: string; roles: Role[] } };

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
	if (spec.roles.length > 1) {
		const role = lastRole(store, userId, character.id, spec.id);
		if (!role) {
			return { ask: { character, specId: spec.id, roles: spec.roles } };
		}
		return { choice: { character, specId: spec.id, role } };
	}
	return { choice: { character, specId: spec.id, role: spec.roles[0] } };
}

async function answer(interaction: ButtonInteraction, store: EventStore, event: RaidEvent, status: SignupStatus): Promise<void> {
	const userId = interaction.user.id;
	const name = displayNameOf(interaction);

	// No character needed: the post itself shows the answer, updated through the click
	if (event.kind === 'event' || !characterStatuses.includes(status)) {
		respond(event, userId, name, status);
		saveEvents(store);
		await interaction.update(render(event));
		// A queued edit from an earlier click could land after this one with an older roster. One
		// more queued edit always draws the latest
		await updatePost(interaction.client, event.id);
		return;
	}

	// An earlier sign-up keeps its character when only the status changes
	const existing = event.signups.find(s => s.userId === userId);
	if (existing?.character) {
		const signup = respond(event, userId, name, status);
		saveEvents(store);
		await interaction.reply({ ...signupReply(event, signup, charactersOf(loadCharacters(), userId, event.game), userId), flags: MessageFlags.Ephemeral });
		await updatePost(interaction.client, event.id);
		return;
	}

	const characters = charactersOf(loadCharacters(), userId, event.game);
	const pick = pickFor(store, userId, characters);
	if (!pick) {
		// Add one first. The character panel signs them up once it's saved
		const panel = buildCharacterPanel(loadCharacters(), userId, {
			kind: 'pick-class',
			game: event.game,
			then: `${event.id}/${status}`,
			notice: `Add your ${gameName(event.game)} character first. You're signed up as soon as it's saved.`,
		});
		await interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
		return;
	}
	if ('ask' in pick) {
		await interaction.reply({ ...roleQuestion(event, status, pick.ask.character, pick.ask.specId, pick.ask.roles), flags: MessageFlags.Ephemeral });
		return;
	}
	const signup = respond(event, userId, name, status, pick.choice);
	saveEvents(store);
	await interaction.reply({ ...signupReply(event, signup, characters, userId), flags: MessageFlags.Ephemeral });
	await updatePost(interaction.client, event.id);
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
	const [eventId, action, ...args] = interaction.customId.slice(eventPrefix.length).split(':');

	if (interaction.isModalSubmit()) {
		if (!isOfficer(interaction)) {
			await interaction.reply({ content: 'Only officers can create or edit events.', flags: MessageFlags.Ephemeral });
			return;
		}
		if (eventId === 'new' && isGameId(action) && (args[0] === 'raid' || args[0] === 'event')) {
			await createFromForm(interaction, action, args[0]);
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
		await interaction.showModal(buildEventModal(draft.game, draft.kind, { existing, values: draft.values }));
		return;
	}

	const store = loadEvents();
	const event = store[eventId];
	if (!event) {
		await interaction.reply({ content: 'This event no longer exists.', flags: MessageFlags.Ephemeral });
		return;
	}

	// Members' answers on the post, and the role buttons and switch menu in their private reply
	if (answerStatuses.includes(action as SignupStatus) || action === 'withdraw' || action === 'choose' || action === 'role') {
		if (event.cancelled || event.closed) {
			await interaction.reply({ content: event.cancelled ? 'This event was cancelled.' : 'Sign-ups are closed.', flags: MessageFlags.Ephemeral });
			return;
		}
		const userId = interaction.user.id;
		if (action === 'withdraw') {
			if (!withdraw(event, userId)) {
				await interaction.reply({ content: "You're not signed up.", flags: MessageFlags.Ephemeral });
				return;
			}
			saveEvents(store);
			await (interaction as ButtonInteraction).update(render(event));
			await updatePost(interaction.client, event.id);
			return;
		}
		if (action === 'choose' || action === 'role') {
			const characters = charactersOf(loadCharacters(), userId, event.game);
			const value = action === 'choose' && interaction.isStringSelectMenu() ? interaction.values[0] : args.slice(1).join('|');
			const choice = findChoice(characters, value);
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
		case 'edit':
			await interaction.showModal(buildEventModal(event.game, event.kind, { existing: event }));
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
		case 'cancel-yes':
			event.cancelled = true;
			saveEvents(store);
			log(`${interaction.user.username} cancelled ${event.title}`);
			await interaction.update(managePanel(event));
			await updatePost(interaction.client, event.id);
			return;
		default:
			log.warn(`Unknown event action: ${interaction.customId}`);
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
	const tick = async () => {
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
		} catch (error) {
			log.error(`Event timer failed: ${error}`);
		}
	};
	void tick();
	setInterval(tick, 60 * 1000);
}

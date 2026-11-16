import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import type {
	ButtonInteraction,
	MessageActionRowComponentBuilder,
	ModalSubmitInteraction,
	StringSelectMenuInteraction,
} from 'discord.js';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import {
	addCharacter,
	characterName,
	charactersOf,
	describeCharacter,
	gameName,
	loadCharacters,
	maxCharactersPerGame,
	removeCharacter,
	saveCharacters,
	setMain,
	updateCharacter,
} from './characters.js';
import type { Character, CharacterStore } from './characters.js';
import { findClass, findSpec, gameIds, games, isGameId } from './games.js';
import type { GameId } from './games.js';

// IDs are characters:<owner's user ID>:<action>:<arguments>. The owner is whose characters the panel
// shows: the member themselves, or the member an officer opened with /characters member
export const charactersPrefix = 'characters:';

const color = 0x3498DB;
const noOffSpec = 'none';

// What the private panel shows. A notice is the line above it saying what just happened
export type View =
	| { kind: 'home'; notice?: string }
	// then: a sign-up waiting for this character ("<event ID>/<status>"), done once it's saved
	| { kind: 'pick-class'; game: GameId; then?: string; notice?: string }
	| { kind: 'character'; id: string; notice?: string }
	| { kind: 'confirm-remove'; id: string }
	// A form that was turned down, with a button to open it again as it was filled in
	| { kind: 'rejected'; notice: string; back: View };

export interface PanelContent {
	content: string;
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
	// Mentions in a notice read as names without pinging anyone
	allowedMentions: { parse: [] };
}

// What was typed in the form, kept so a turned-down form opens again filled in
export interface FormValues {
	name: string;
	realm: string;
	specId: string;
	offSpecId?: string;
}

interface Draft {
	ownerId: string;
	game: GameId;
	classId: string;
	editId?: string;
	then?: string;
	values: FormValues;
}

// Called once a character added from a sign-up is saved, to make the sign-up and answer the member
export type SignupHook = (interaction: ModalSubmitInteraction, then: string, character: Character) => Promise<void>;
let signupHook: SignupHook | undefined;

export function setSignupHook(hook: SignupHook): void {
	signupHook = hook;
}

// The last turned-down form per member using the panel
const drafts = new Map<string, Draft>();

type ComponentInteraction = ButtonInteraction | StringSelectMenuInteraction;

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
	return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...components);
}

export function homeRealm(game: GameId): string {
	return game === 'retail' ? config.events?.realm ?? '' : '';
}

function nameOf(character: Character): string {
	return characterName(character, homeRealm(character.game));
}

class Panel {
	// ownerName is set when an officer looks at someone else's characters
	constructor(private store: CharacterStore, private ownerId: string, private ownerName?: string) {}

	private button(id: string, label: string, style = ButtonStyle.Secondary): ButtonBuilder {
		return new ButtonBuilder().setCustomId(`${charactersPrefix}${this.ownerId}:${id}`).setLabel(label).setStyle(style);
	}

	private content(notice: string | undefined, embeds: EmbedBuilder[], components: ActionRowBuilder<MessageActionRowComponentBuilder>[]): PanelContent {
		return { content: notice ?? '', embeds, components, allowedMentions: { parse: [] } };
	}

	build(view: View): PanelContent {
		switch (view.kind) {
			case 'pick-class':
				return this.pickClass(view.game, view.then, view.notice);
			case 'rejected':
				return this.content(view.notice, [], [row(
					this.button('retry', 'Try again', ButtonStyle.Primary),
					this.button(view.back.kind === 'character' ? `character:${view.back.id}`
						: view.back.kind === 'pick-class' ? `add:${view.back.game}${view.back.then ? `:${view.back.then}` : ''}`
						: 'home', 'Back'),
				)]);
			case 'character':
			case 'confirm-remove': {
				const character = this.store[this.ownerId]?.find(c => c.id === view.id);
				if (!character) {
					return this.home('That character is no longer saved.');
				}
				return view.kind === 'character' ? this.character(character, view.notice) : this.confirmRemove(character);
			}
			default:
				return this.home(view.notice);
		}
	}

	private home(notice?: string): PanelContent {
		const lines: string[] = [];
		for (const game of gameIds) {
			lines.push(`**${gameName(game)}**`);
			const characters = charactersOf(this.store, this.ownerId, game);
			if (characters.length === 0) {
				lines.push('No characters yet.');
			}
			for (const character of characters) {
				lines.push(`${character.main ? '⭐ ' : ''}${nameOf(character)}: ${describeCharacter(character)}`);
			}
			lines.push('');
		}
		const embed = new EmbedBuilder()
			.setColor(color)
			.setTitle(this.ownerName ? `${this.ownerName}'s characters` : 'Your characters')
			.setDescription(lines.join('\n').trim())
			.setFooter({ text: '⭐ Main, used for raid sign-ups' });

		const all = charactersOf(this.store, this.ownerId);
		const rows = [row(...gameIds.map(game => this.button(`add:${game}`, `Add ${gameName(game)} character`, ButtonStyle.Primary)
			.setDisabled(charactersOf(this.store, this.ownerId, game).length >= maxCharactersPerGame)))];
		if (all.length > 0) {
			rows.push(row(new StringSelectMenuBuilder()
				.setCustomId(`${charactersPrefix}${this.ownerId}:pick`)
				.setPlaceholder('Pick a character')
				.addOptions(all.map(character => ({
					label: nameOf(character),
					description: `${gameName(character.game)}, ${describeCharacter(character)}`.slice(0, 100),
					value: character.id,
				})))));
		}
		return this.content(notice, [embed], rows);
	}

	// Buttons rather than a menu: a menu doesn't react when the same class is picked again after
	// closing the form. 13 classes fit in three rows of five, with Back on a fourth
	private pickClass(game: GameId, then?: string, notice?: string): PanelContent {
		const embed = new EmbedBuilder()
			.setColor(color)
			.setTitle(`New ${gameName(game)} character`)
			.setDescription('Pick a class.');
		const classButtons = games[game].classes.map(c => this.button(`class:${game}:${c.id}${then ? `:${then}` : ''}`, c.name));
		const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
		for (let i = 0; i < classButtons.length; i += 5) {
			rows.push(row(...classButtons.slice(i, i + 5)));
		}
		// From a sign-up there is no panel to go back to
		if (!then) {
			rows.push(row(this.button('home', 'Back')));
		}
		return this.content(notice, [embed], rows);
	}

	private character(character: Character, notice?: string): PanelContent {
		const offSpec = character.offSpecId ? findSpec(character.game, character.classId, character.offSpecId) : undefined;
		const lines = [`Game: ${gameName(character.game)}`];
		if (character.realm) {
			lines.push(`Realm: ${character.realm}`);
		}
		lines.push(
			`Class: ${findClass(character.game, character.classId)?.name ?? '?'}`,
			`Spec: ${findSpec(character.game, character.classId, character.specId)?.name ?? '?'}`,
			`Off-spec: ${offSpec?.name ?? 'None'}`,
		);
		const embed = new EmbedBuilder()
			.setColor(color)
			.setTitle(`${character.main ? '⭐ ' : ''}${character.name}`)
			.setDescription(lines.join('\n'));
		if (character.main) {
			embed.setFooter({ text: `${gameName(character.game)} main` });
		}
		return this.content(notice, [embed], [row(
			this.button(`edit:${character.id}`, 'Edit', ButtonStyle.Primary),
			this.button(`main:${character.id}`, 'Make main').setDisabled(character.main),
			this.button(`remove:${character.id}`, 'Remove', ButtonStyle.Danger),
			this.button('home', 'Back'),
		)]);
	}

	private confirmRemove(character: Character): PanelContent {
		return this.content(`Remove ${nameOf(character)}?`, [], [row(
			this.button(`remove-yes:${character.id}`, 'Remove', ButtonStyle.Danger),
			this.button(`character:${character.id}`, 'Cancel'),
		)]);
	}
}

export function buildCharacterPanel(store: CharacterStore, ownerId: string, view: View, ownerName?: string): PanelContent {
	return new Panel(store, ownerId, ownerName).build(view);
}
// The form for a new character of a class, or for editing a saved one. Forever has no realms, so no
// realm field
// everyone there plays on the guild's realm
export function buildCharacterModal(ownerId: string, game: GameId, classId: string, { existing, values, then }: { existing?: Character; values?: FormValues; then?: string } = {}): ModalBuilder {
	const wowClass = findClass(game, classId)!;
	const filled: Partial<FormValues> = values ?? (existing
		? { name: existing.name, realm: existing.realm, specId: existing.specId, offSpecId: existing.offSpecId }
		: { realm: homeRealm(game) });

	const nameInput = new TextInputBuilder().setCustomId('name').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(12).setRequired(true);
	if (filled.name) {
		nameInput.setValue(filled.name);
	}
	const fields = [new LabelBuilder().setLabel('Character name').setTextInputComponent(nameInput)];

	if (game === 'retail') {
		const realmInput = new TextInputBuilder().setCustomId('realm').setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(true);
		if (filled.realm) {
			realmInput.setValue(filled.realm);
		}
		fields.push(new LabelBuilder().setLabel('Realm').setTextInputComponent(realmInput));
	}

	fields.push(
		new LabelBuilder().setLabel('Spec').setStringSelectMenuComponent(new StringSelectMenuBuilder()
			.setCustomId('spec')
			.setPlaceholder('Spec')
			.addOptions(wowClass.specs.map(spec => ({ label: spec.name, value: spec.id, default: spec.id === filled.specId })))),
		// An explicit None, since a menu can't always be emptied once something is picked
		new LabelBuilder().setLabel('Off-spec').setStringSelectMenuComponent(new StringSelectMenuBuilder()
			.setCustomId('off-spec')
			.addOptions(
				{ label: 'None', value: noOffSpec, default: !filled.offSpecId },
				...wowClass.specs.map(spec => ({ label: spec.name, value: spec.id, default: spec.id === filled.offSpecId })),
			)),
	);

	const target = existing ? `save:${existing.id}` : `new:${game}:${classId}${then ? `:${then}` : ''}`;
	return new ModalBuilder()
		.setCustomId(`${charactersPrefix}${ownerId}:${target}`)
		.setTitle(existing ? `Edit ${existing.name}` : `New ${gameName(game)} ${wowClass.name}`)
		.addLabelComponents(...fields);
}

// /characters: a member's own characters, or an officer looking at someone else's
export function openCharacterPanel(ownerId: string, ownerName?: string): PanelContent {
	return buildCharacterPanel(loadCharacters(), ownerId, { kind: 'home' }, ownerName);
}

function formValues(interaction: ModalSubmitInteraction, game: GameId): FormValues {
	const offSpec = interaction.fields.getStringSelectValues('off-spec')[0];
	return {
		name: interaction.fields.getTextInputValue('name'),
		realm: game === 'retail' ? interaction.fields.getTextInputValue('realm') : '',
		specId: interaction.fields.getStringSelectValues('spec')[0] ?? '',
		offSpecId: offSpec && offSpec !== noOffSpec ? offSpec : undefined,
	};
}

async function show(interaction: ComponentInteraction | ModalSubmitInteraction, content: PanelContent): Promise<void> {
	if (interaction.isModalSubmit() && !interaction.isFromMessage()) {
		await interaction.reply({ ...content, flags: MessageFlags.Ephemeral });
		return;
	}
	await (interaction as ComponentInteraction).update(content);
}

function isOfficer(interaction: ComponentInteraction | ModalSubmitInteraction): boolean {
	return interaction.inCachedGuild() && interaction.member.roles.cache.has(config.roles.officer);
}

// Every button, menu and form on the panel
export async function handleCharacterInteraction(interaction: ComponentInteraction | ModalSubmitInteraction): Promise<void> {
	const [ownerId, action, ...args] = interaction.customId.slice(charactersPrefix.length).split(':');
	const viewerId = interaction.user.id;
	if (ownerId !== viewerId && !isOfficer(interaction)) {
		await interaction.reply({ content: "Only officers can change other members' characters.", flags: MessageFlags.Ephemeral });
		return;
	}
	const store = loadCharacters();
	let ownerName: string | undefined;
	if (ownerId !== viewerId && interaction.inCachedGuild()) {
		const owner = await interaction.guild.members.fetch(ownerId).catch(() => null);
		ownerName = owner?.displayName ?? (await interaction.client.users.fetch(ownerId).catch(() => null))?.username ?? 'Member';
	}
	const render = (view: View) => show(interaction, buildCharacterPanel(store, ownerId, view, ownerName));
	const who = ownerId === viewerId ? interaction.user.username : `${interaction.user.username} (for ${ownerName})`;

	if (interaction.isModalSubmit()) {
		const draft = { ownerId, game: args[0] as GameId, classId: args[1], then: args[2] };
		if (action === 'new' && isGameId(draft.game) && findClass(draft.game, draft.classId)) {
			const values = formValues(interaction, draft.game);
			const result = addCharacter(store, ownerId, { game: draft.game, classId: draft.classId, ...values });
			if ('error' in result) {
				drafts.set(viewerId, { ...draft, values });
				await render({ kind: 'rejected', notice: result.error, back: draft.then ? { kind: 'pick-class', game: draft.game, then: draft.then } : { kind: 'home' } });
				return;
			}
			saveCharacters(store);
			log(`${who} saved ${gameName(draft.game)} character ${nameOf(result)}`);
			if (draft.then && signupHook) {
				await signupHook(interaction, draft.then, result);
				return;
			}
			await render({ kind: 'home', notice: result.main ? `Saved ${result.name} as ${gameName(draft.game)} main.` : `Saved ${result.name}.` });
			return;
		}
		const existing = action === 'save' ? store[ownerId]?.find(c => c.id === args[0]) : undefined;
		if (existing) {
			const values = formValues(interaction, existing.game);
			const result = updateCharacter(store, ownerId, existing.id, values);
			if ('error' in result) {
				drafts.set(viewerId, { ownerId, game: existing.game, classId: existing.classId, editId: existing.id, values });
				await render({ kind: 'rejected', notice: result.error, back: { kind: 'character', id: existing.id } });
				return;
			}
			saveCharacters(store);
			log(`${who} edited ${gameName(result.game)} character ${nameOf(result)}`);
			await render({ kind: 'character', id: result.id, notice: 'Saved.' });
			return;
		}
		await render({ kind: 'home', notice: 'That character is no longer saved.' });
		return;
	}

	switch (action) {
		case 'home':
			await render({ kind: 'home' });
			return;
		case 'add':
			if (isGameId(args[0])) {
				await render({ kind: 'pick-class', game: args[0], then: args[1] });
			}
			return;
		case 'class':
			if (isGameId(args[0]) && findClass(args[0], args[1])) {
				await interaction.showModal(buildCharacterModal(ownerId, args[0], args[1], { then: args[2] }));
			}
			return;
		case 'retry': {
			const draft = drafts.get(viewerId);
			const existing = draft?.editId ? store[ownerId]?.find(c => c.id === draft.editId) : undefined;
			if (!draft || draft.ownerId !== ownerId || (draft.editId && !existing)) {
				await render({ kind: 'home', notice: 'That form was lost. Start it again.' });
				return;
			}
			await interaction.showModal(buildCharacterModal(ownerId, draft.game, draft.classId, { existing, values: draft.values, then: draft.then }));
			return;
		}
		case 'pick':
			if (interaction.isStringSelectMenu()) {
				await render({ kind: 'character', id: interaction.values[0] });
			}
			return;
		case 'character':
			await render({ kind: 'character', id: args[0] });
			return;
		case 'edit': {
			const character = store[ownerId]?.find(c => c.id === args[0]);
			if (!character) {
				await render({ kind: 'home', notice: 'That character is no longer saved.' });
				return;
			}
			await interaction.showModal(buildCharacterModal(ownerId, character.game, character.classId, { existing: character }));
			return;
		}
		case 'main': {
			const result = setMain(store, ownerId, args[0]);
			if ('error' in result) {
				await render({ kind: 'home', notice: result.error });
				return;
			}
			saveCharacters(store);
			await render({ kind: 'character', id: result.id, notice: `${result.name} is now the ${gameName(result.game)} main.` });
			return;
		}
		case 'remove':
			await render({ kind: 'confirm-remove', id: args[0] });
			return;
		case 'remove-yes': {
			const result = removeCharacter(store, ownerId, args[0]);
			if ('error' in result) {
				await render({ kind: 'home', notice: result.error });
				return;
			}
			saveCharacters(store);
			const { removed, newMain } = result;
			log(`${who} removed ${gameName(removed.game)} character ${nameOf(removed)}`);
			await render({
				kind: 'home',
				notice: newMain ? `Removed ${removed.name}. ${newMain.name} is now the ${gameName(removed.game)} main.` : `Removed ${removed.name}.`,
			});
			return;
		}
		default:
			log.warn(`Unknown character panel action: ${interaction.customId}`);
			await render({ kind: 'home' });
	}
}

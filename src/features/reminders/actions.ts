import { ActionRowBuilder, PermissionFlagsBits, StringSelectMenuBuilder } from 'discord.js';
import type { Client, EmbedBuilder, Guild, InteractionEditReplyOptions, MessageActionRowComponentBuilder, Role, StringSelectMenuInteraction } from 'discord.js';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import UserError from '../../core/user-error.js';
import { confirmationCard, listCard, menuLabel, shorten } from './format.js';
import type { CardState } from './format.js';
import { addReminder, canCancel, cancelReminder, loadReminders, saveReminders, visibleTo } from './store.js';
import type { Reminder, ReminderTarget } from './store.js';
import { parseReminderTime } from './time.js';

// Setting, listing and cancelling, shared by /remind and the chat tools

export const remindersPrefix = 'reminders:';

export interface SetRequest {
	target: ReminderTarget;
	when: string;
	text: string;
	role?: Role;
	userId: string;
	userName: string;
	guild: Guild;
	channelId: string;
	messageId?: string;
	isOfficer: boolean;
}

export function isOfficerMember(member: { roles: { cache: { has(id: string): boolean } } } | null | undefined): boolean {
	return !!member?.roles.cache.has(config.roles.officer);
}

// Whether @here pings in the channel. A thread takes its parent's permissions, and a channel not
// loaded yet counts as no
export function canPingHere(guild: Guild, channelId: string): boolean {
	const me = guild.members.me;
	return !!me && !!guild.channels.cache.get(channelId)?.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone);
}

// A role the reminder can actually ping
function checkRole(guild: Guild, role: Role | undefined): void {
	if (!role) {
		throw new UserError('Which role should I remind?');
	}
	if (role.id === guild.id) {
		throw new UserError('Reminders can ping a role, but not @everyone.');
	}
	const canPing = role.mentionable || !!guild.members.me?.permissions.has(PermissionFlagsBits.MentionEveryone);
	if (!canPing) {
		throw new UserError(`I can't ping ${role.name}. Make the role mentionable in Server Settings, or give me the Mention Everyone permission.`);
	}
}

// Saves the reminder and returns it. Throws UserError with what to fix
export function setReminder(request: SetRequest, now = Date.now()): Reminder {
	if (request.target === 'role' && request.isOfficer) {
		checkRole(request.guild, request.role);
	}
	// Without the permission, @here shows as plain text and pings nobody
	if (request.target === 'channel' && request.isOfficer && !canPingHere(request.guild, request.channelId)) {
		throw new UserError("I can't ping @here in this channel. Give me the Mention Everyone permission here first.");
	}
	const due = parseReminderTime(request.when, now);
	if (typeof due !== 'number') {
		throw new UserError(due.error);
	}
	const store = loadReminders();
	const reminder = addReminder(store, {
		target: request.target,
		userId: request.userId,
		userName: request.userName,
		roleId: request.target === 'role' ? request.role?.id : undefined,
		guildId: request.guild.id,
		channelId: request.channelId,
		messageId: request.messageId,
		text: request.text,
		due,
		createdAt: now,
	}, request.isOfficer);
	saveReminders(store);
	log(`Reminder #${reminder.number} set by ${request.userName} for ${new Date(due).toISOString()}`);
	return reminder;
}

// The private list, with a menu to cancel the ones this member may cancel
export function listView(userId: string, channelId: string, isOfficer: boolean, notice?: string): InteractionEditReplyOptions {
	const { own, channel } = visibleTo(loadReminders(), userId, channelId);
	const reply = { content: notice ?? '', embeds: [listCard(own, channel, channelId)] };
	const cancellable = [...own, ...channel].filter(r => canCancel(r, userId, isOfficer)).slice(0, 25);
	if (cancellable.length === 0) {
		return { ...reply, components: [] };
	}
	const menu = new StringSelectMenuBuilder()
		.setCustomId(`${remindersPrefix}cancel:${channelId}`)
		.setPlaceholder('Cancel a reminder')
		.addOptions(cancellable.map(r => ({ label: menuLabel(r), value: String(r.number) })));
	return { ...reply, components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu)] };
}

// Turns the card that confirmed a reminder grey, saying it was sent or cancelled. A card that's
// gone or can't be edited is left alone
export async function updateCard(client: Client, reminder: Reminder, state: CardState, sent?: { url: string; at: number }): Promise<void> {
	if (!reminder.confirmationId) {
		return;
	}
	try {
		const channel = await client.channels.fetch(reminder.channelId);
		if (!channel?.isTextBased()) {
			return;
		}
		// One reply can confirm several reminders: only this one's card changes
		const message = await channel.messages.fetch(reminder.confirmationId);
		const title = `Reminder #${reminder.number}`;
		const embeds = message.embeds.map(embed => embed.title?.endsWith(title) ? confirmationCard(reminder, state, sent) : embed);
		await message.edit({ embeds });
	} catch (error) {
		log.warn(`Couldn't update the card for reminder #${reminder.number}: ${error}`);
	}
}

// The cancel menu under the list
export async function handleReminderInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
	const channelId = interaction.customId.split(':')[2] ?? interaction.channelId;
	const isOfficer = interaction.inCachedGuild() && isOfficerMember(interaction.member);
	const store = loadReminders();
	let notice: string;
	try {
		const cancelled = cancelReminder(store, Number(interaction.values[0]), interaction.user.id, isOfficer);
		saveReminders(store);
		log(`Reminder #${cancelled.number} cancelled by ${interaction.user.username}`);
		notice = `Cancelled reminder #${cancelled.number}: ${shorten(cancelled.text, 80)}`;
		updateCard(interaction.client, cancelled, 'cancelled');
	} catch (error) {
		if (!(error instanceof UserError)) {
			throw error;
		}
		notice = error.message;
	}
	await interaction.update(listView(interaction.user.id, channelId, isOfficer, notice) as any);
}

// For chat: the asker's reminders and the channel's, as a message everyone sees, so only those that
// fire in this channel. /reminders shows the rest privately
export function chatList(userId: string, userName: string, channelId: string): EmbedBuilder {
	const { own, channel } = visibleTo(loadReminders(), userId, channelId);
	const here = own.filter(r => r.channelId === channelId);
	const card = listCard(here, channel, channelId, `${userName} has no reminders in this channel. /reminders shows all of yours.`);
	return card.setDescription(card.data.description!.replace('**Your reminders**', () => `**${userName}'s reminders**`));
}

// Cancels by the number the model gives ("12" or "#12") and returns the reminder
export function chatCancel(number: string | number, userId: string, isOfficer: boolean): Reminder {
	const parsed = Number(String(number).replace(/\D/g, ''));
	if (!parsed) {
		throw new UserError('Which reminder? Give its number, like #12.');
	}
	const store = loadReminders();
	const cancelled = cancelReminder(store, parsed, userId, isOfficer);
	saveReminders(store);
	log(`Reminder #${cancelled.number} cancelled in chat by ${userId}`);
	return cancelled;
}

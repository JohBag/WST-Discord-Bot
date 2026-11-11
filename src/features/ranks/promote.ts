import { DiscordAPIError, PermissionFlagsBits, RESTJSONErrorCodes } from 'discord.js';
import type { GuildMember } from 'discord.js';
import { config } from '../../core/config.js';
import log from '../../core/log.js';
import UserError from '../../core/user-error.js';
import { listAnd, planPromotion } from './plan.js';
import type { Rank } from './plan.js';

const roleOrderHelp = 'My role has to be above every rank in Server Settings > Roles.';

// Moves the target up one rank (config.roles.ranks). Only officers may. Returns the private reply
// for the officer; nothing is posted for anyone else.
export default async function promote(officer: GuildMember, target: GuildMember): Promise<string> {
	if (!officer.roles.cache.has(config.roles.officer)) {
		throw new UserError('Only officers can promote members.');
	}

	const guild = target.guild;
	const ranks: Rank[] = config.roles.ranks.map(id => {
		const role = guild.roles.cache.get(id);
		if (!role) {
			log.warn(`Rank role ${id} not found in ${guild.name}`);
			throw new UserError("This server doesn't have the ranks I'm set up with.");
		}
		return { id, name: role.name };
	});

	// The role cache includes @everyone, which isn't a role anyone is given
	const held = [...target.roles.cache.keys()].filter(id => id !== guild.id);
	const plan = planPromotion(target.displayName, held, ranks);
	if ('error' in plan) {
		throw new UserError(plan.error);
	}

	// Check before changing anything, so a wrong role order changes nothing
	if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
		throw new UserError('I need the Manage Roles permission to change ranks.');
	}
	const blocked = plan.changed.filter(id => !guild.roles.cache.get(id)?.editable);
	if (blocked.length > 0) {
		const names = ranks.filter(rank => blocked.includes(rank.id)).map(rank => rank.name);
		throw new UserError(`I can't hand out or take away ${listAnd(names)}. ${roleOrderHelp}`);
	}

	try {
		// One change with the whole role list, so it either fully happens or not at all
		await target.roles.set(plan.roles, `Promoted by ${officer.user.username}`);
	} catch (error) {
		// The ranks passed the check above, so Discord objected to something else about this member
		if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions) {
			log.warn(`Promoting ${target.displayName} refused by Discord: ${error.message}`);
			throw new UserError(`Discord didn't let me change ${target.displayName}'s roles. Nothing changed.`);
		}
		throw error;
	}

	log(`${officer.displayName} promoted ${target.displayName} from ${plan.from.name} to ${plan.to.name}`);
	return `${target.displayName} is now a ${plan.to.name}.`;
}

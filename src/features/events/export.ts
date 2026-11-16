import { realmForInvite } from './characters.js';
import { findSpec } from './games.js';
import type { RaidEvent, Signup } from './store.js';

// The roster as JSON for the Raid-Helper Helper addon (/rhh in game), which invites everyone in it
// and sorts them into groups. It reads Raid-Helper's own export format, of which it uses only these:
// signUps, each with name (the character to invite, always Name-Realm for retail),
// className (the role column: Tank, Healer, Melee or Ranged) and specName (Raid-Helper's spec name,
// which tells the addon the class). Without a position the addon takes the order in the list, five
// to a group, which is the answering order, so it's left out to keep the export short.

export interface ExportEntry {
	name: string;
	className: 'Tank' | 'Healer' | 'Melee' | 'Ranged';
	specName: string;
}

// Signed up and Late, in answering order (decided 2026-11-16). Tentative and Absent are left out,
// so the addon doesn't keep inviting people who said maybe
function roster(event: RaidEvent): Signup[] {
	return event.signups
		.filter(s => (s.status === 'signed' || s.status === 'late') && s.character)
		.sort((a, b) => a.number - b.number);
}

// Always with the realm, the guild's own too: an officer inviting from a connected realm (Hellscream
// for Aggramar) would otherwise invite a namesake there, and the addon would never see them join.
// The addon drops the realm itself when it's the officer's own. Forever has no realms
function inviteName(signup: Signup): string {
	const { name, realm } = signup.character!;
	return realm ? `${name}-${realmForInvite(realm)}` : name;
}

export function exportEntries(event: RaidEvent): ExportEntry[] {
	return roster(event).map(signup => {
		const character = signup.character!;
		const spec = findSpec(event.game, character.classId, character.specId);
		// The post has one DPS role. The addon wants melee or ranged, which the spec knows
		const role = character.role as string;
		const className = role === 'Tank' || role === 'Healer' || role === 'Melee' || role === 'Ranged'
			? role
			: spec?.roles.find(r => r === 'Melee' || r === 'Ranged') ?? 'Melee';
		return {
			name: inviteName(signup),
			className,
			specName: spec?.raidHelperName ?? character.specId,
		};
	});
}

// Without spaces: a full 40-player raid stays well inside the 4000 characters of the copy box
export function exportJson(event: RaidEvent): string {
	return JSON.stringify({ signUps: exportEntries(event) });
}

// WoW Forever: the Raid-Helper Helper addon doesn't load there, so until our own addon reads the
// export, it's the names to invite, one per line
export function exportNames(event: RaidEvent): string {
	return roster(event).map(inviteName).join('\n');
}

// What the Export button gives for the event's game
export function exportText(event: RaidEvent): string {
	return event.game === 'retail' ? exportJson(event) : exportNames(event);
}

export function rosterSize(event: RaidEvent): number {
	return roster(event).length;
}

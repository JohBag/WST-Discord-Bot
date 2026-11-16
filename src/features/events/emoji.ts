import type { Client } from 'discord.js';
import log from '../../core/log.js';

// Class icons as emoji on Botty's own Discord application, so posts can show them in any server.
// Uploaded once from Blizzard's icon server and found by name after that. Each bot (test and
// production) uploads to its own application. Nothing is committed to the repo.

// Short names, since each one is written out on every roster line (<:dk:123...>)
export const emojiNames: Record<string, string> = {
	DEATHKNIGHT: 'dk',
	DEMONHUNTER: 'dh',
	DRUID: 'dru',
	EVOKER: 'evo',
	HUNTER: 'hun',
	MAGE: 'mag',
	MONK: 'mnk',
	PALADIN: 'pal',
	PRIEST: 'pri',
	ROGUE: 'rog',
	SHAMAN: 'sha',
	WARLOCK: 'wl',
	WARRIOR: 'war',
};

const iconUrl = (classId: string) => `https://render.worldofwarcraft.com/eu/icons/56/classicon_${classId.toLowerCase()}.jpg`;

const classEmoji = new Map<string, string>();

export function getClassEmoji(classId: string): string {
	return classEmoji.get(classId) ?? '';
}

export async function syncClassEmoji(client: Client): Promise<void> {
	let existing;
	try {
		existing = await client.application!.emojis.fetch();
	} catch (error) {
		log.warn(`Class icons unavailable: ${error}`);
		return;
	}
	for (const [classId, name] of Object.entries(emojiNames)) {
		// Each on its own, so one failed upload doesn't cost the rest their icons. Posts read fine without
		try {
			let emoji = existing.find(e => e.name === name);
			if (!emoji) {
				emoji = await client.application!.emojis.create({ attachment: iconUrl(classId), name });
				log(`Uploaded class icon ${name}`);
			}
			classEmoji.set(classId, `<:${name}:${emoji.id}>`);
		} catch (error) {
			log.warn(`No icon for ${classId}: ${error}`);
		}
	}
	// Icons from before the short names
	for (const old of existing.filter(e => e.name?.startsWith('class_')).values()) {
		await old.delete().catch((error: unknown) => log.warn(`Couldn't remove old icon ${old.name}: ${error}`));
	}
}

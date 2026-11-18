import type { Client } from 'discord.js';
import log from '../../core/log.js';
import { crop, decodeBlp, encodePng, squareToContent } from './texture.js';

// WoW's icons as emoji on Botty's own Discord application, so posts can show them in any server.
// Uploaded once and found by name after that. Each bot (test and production) uploads to its own
// application. Nothing is committed to the repo.

// Each spec's icon, as retail's own spec table (ChrSpecialization) gives it. Forever uses the same
// (unverified whether its own client shows these or vanilla's talent tab icons), and its Combat rogue
// the vanilla Combat talent tab's icon
export const specIcons: Record<string, Record<string, string>> = {
	DEATHKNIGHT: { blood: 'spell_deathknight_bloodpresence', frost: 'spell_deathknight_frostpresence', unholy: 'spell_deathknight_unholypresence' },
	DEMONHUNTER: { havoc: 'ability_demonhunter_specdps', vengeance: 'ability_demonhunter_spectank', devourer: 'classicon_demonhunter_void' },
	DRUID: { balance: 'spell_nature_starfall', feral: 'ability_druid_catform', guardian: 'ability_racial_bearform', restoration: 'spell_nature_healingtouch' },
	EVOKER: { devastation: 'classicon_evoker_devastation', preservation: 'classicon_evoker_preservation', augmentation: 'classicon_evoker_augmentation' },
	HUNTER: { 'beast-mastery': 'ability_hunter_bestialdiscipline', marksmanship: 'ability_hunter_focusedaim', survival: 'ability_hunter_camouflage' },
	MAGE: { arcane: 'spell_holy_magicalsentry', fire: 'spell_fire_firebolt02', frost: 'spell_frost_frostbolt02' },
	MONK: { brewmaster: 'spell_monk_brewmaster_spec', mistweaver: 'spell_monk_mistweaver_spec', windwalker: 'spell_monk_windwalker_spec' },
	PALADIN: { holy: 'spell_holy_holybolt', protection: 'ability_paladin_shieldofthetemplar', retribution: 'spell_holy_auraoflight' },
	PRIEST: { discipline: 'spell_holy_powerwordshield', holy: 'spell_holy_guardianspirit', shadow: 'spell_shadow_shadowwordpain' },
	ROGUE: { assassination: 'ability_rogue_deadlybrew', outlaw: 'ability_rogue_waylay', combat: 'ability_backstab', subtlety: 'ability_stealth' },
	SHAMAN: { elemental: 'spell_nature_lightning', enhancement: 'spell_shaman_improvedstormstrike', restoration: 'spell_nature_magicimmunity' },
	WARLOCK: { affliction: 'spell_shadow_deathcoil', demonology: 'spell_shadow_metamorphosis', destruction: 'spell_shadow_rainoffire' },
	WARRIOR: { arms: 'ability_warrior_savageblow', fury: 'ability_warrior_innerrage', protection: 'ability_warrior_defensivestance' },
};

// Short names, since each one is written out on every roster line (<:pal_hol:123...>)
const classNames: Record<string, string> = {
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

export function specEmojiName(classId: string, specId: string): string {
	return `${classNames[classId]}_${specId.slice(0, 3)}`;
}

// The interface's own icons: the group finder's role icons and the ready check's marks. These are
// game textures rather than icons, so they come from the game files (wago.tools serves them by
// file ID), cut from the sheet where WoW's UI cuts them
export type WowIcon = 'tank' | 'healer' | 'dps' | 'tentative' | 'absent' | 'ready';

interface Texture {
	name: string;
	fileId: number;
	// x, y and size of the square to cut, or the whole texture
	cell?: [number, number, number];
	// Transparent room around the visible part, in pixels of the cut: the ready check marks fill
	// their square edge to edge, so they get more to sit as large as the round role icons
	margin: number;
}

const roleSheet = 337499; // interface/lfgframe/ui-lfg-icon-roles.blp, 67px cells
export const wowIcons: Record<WowIcon, Texture> = {
	tank: { name: 'tank', fileId: roleSheet, cell: [0, 67, 67], margin: 3 },
	healer: { name: 'heal', fileId: roleSheet, cell: [67, 0, 67], margin: 3 },
	dps: { name: 'dps', fileId: roleSheet, cell: [67, 67, 67], margin: 3 },
	tentative: { name: 'tentative', fileId: 136815, margin: 7 }, // interface/raidframe/readycheck-waiting.blp
	absent: { name: 'absent', fileId: 136813, margin: 7 }, // readycheck-notready.blp
	ready: { name: 'ready', fileId: 136814, margin: 7 }, // readycheck-ready.blp
};

// Shown as a set or not at all, so the role headings never mix WoW's icons with the standard emoji,
// nor do Tentative and Absent. The tick is only on event posts, so it stands alone
const iconSets: WowIcon[][] = [['tank', 'healer', 'dps'], ['tentative', 'absent'], ['ready']];

const iconUrl = (icon: string) => `https://render.worldofwarcraft.com/eu/icons/56/${icon}.jpg`;

// Each download gives up after this, so a slow server can't hold the icons up for long
const downloadTimeout = 15_000;

async function download(url: string): Promise<Buffer> {
	const response = await fetch(url, { signal: AbortSignal.timeout(downloadTimeout) });
	if (!response.ok) {
		throw new Error(`${new URL(url).host} answered ${response.status}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

export async function texturePng(texture: Texture): Promise<Buffer> {
	let image = decodeBlp(await download(`https://wago.tools/api/casc/${texture.fileId}`));
	if (texture.cell) {
		const [x, y, size] = texture.cell;
		image = crop(image, x, y, size, size);
	}
	return encodePng(squareToContent(image, texture.margin));
}

const uploaded = new Map<string, string>();

// Forever's feral druids tank in cat form's spec, so a tank shows the bear, as in the game's tank spec
export function iconSpecId(classId: string, specId: string, role: string): string {
	return classId === 'DRUID' && specId === 'feral' && role === 'Tank' ? 'guardian' : specId;
}

// A spec's icon, the class icon from before while it isn't uploaded, or ''
export function getSpecEmoji(classId: string, specId: string): string {
	return uploaded.get(specEmojiName(classId, specId)) ?? uploaded.get(classNames[classId]) ?? '';
}

// A WoW interface icon, or undefined while any of its set isn't uploaded
export function getWowIcon(icon: WowIcon): string | undefined {
	const set = iconSets.find(s => s.includes(icon))!;
	return set.every(i => uploaded.has(wowIcons[i].name)) ? uploaded.get(wowIcons[icon].name) : undefined;
}

async function fetchExisting(client: Client) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await client.application!.emojis.fetch();
		} catch (error) {
			if (attempt === 3) {
				throw error;
			}
			await new Promise(resolve => setTimeout(resolve, 5_000));
		}
	}
}

// Finds the icons by name and uploads the missing ones. An icon whose name is already there is
// never replaced: to change one, delete it on the application (Developer Portal > Emojis) and restart
export async function syncEmoji(client: Client): Promise<void> {
	let existing;
	try {
		existing = await fetchExisting(client);
	} catch (error) {
		log.warn(`Icons unavailable: ${error}`);
		return;
	}
	// The class icons from before stay as the fallback for a spec icon that failed to upload
	for (const name of Object.values(classNames)) {
		const emoji = existing.find(e => e.name === name);
		if (emoji) {
			uploaded.set(name, `<:${name}:${emoji.id}>`);
		}
	}
	const wanted: { name: string; attachment: () => Promise<Buffer | string> }[] = [
		...Object.entries(specIcons).flatMap(([classId, specs]) => Object.entries(specs).map(([specId, icon]) => (
			{ name: specEmojiName(classId, specId), attachment: () => download(iconUrl(icon)) }))),
		// As a data URL, since discord.js labels any other image buffer as JPEG
		...Object.values(wowIcons).map(texture => ({
			name: texture.name,
			attachment: async () => `data:image/png;base64,${(await texturePng(texture)).toString('base64')}`,
		})),
	];
	for (const { name, attachment } of wanted) {
		// Each on its own, so one failed upload doesn't cost the rest their icons. Posts read fine without
		try {
			let emoji = existing.find(e => e.name === name);
			if (!emoji) {
				emoji = await client.application!.emojis.create({ attachment: await attachment(), name });
				log(`Uploaded icon ${name}`);
			}
			uploaded.set(name, `<:${name}:${emoji.id}>`);
		} catch (error) {
			log.warn(`No icon ${name}: ${error}`);
		}
	}
}

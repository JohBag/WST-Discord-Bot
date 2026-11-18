import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iconPng, specEmojiName, specIcons, markIcons } from './emoji.js';
import { games } from './games.js';

describe('spec icons', () => {
	it('should have an icon for every spec in both games', () => {
		for (const game of Object.values(games)) {
			for (const wowClass of game.classes) {
				for (const spec of wowClass.specs) {
					assert.ok(specIcons[wowClass.id]?.[spec.id], `${game.id} ${wowClass.id} ${spec.id}`);
				}
			}
		}
	});

	it('should give every icon its own short emoji name that Discord accepts', () => {
		const names = [
			...Object.entries(specIcons).flatMap(([classId, specs]) => Object.keys(specs).map(specId => specEmojiName(classId, specId))),
			...Object.values(markIcons).map(t => t.name),
		];
		assert.equal(new Set(names).size, names.length);
		for (const name of names) {
			assert.match(name, /^[a-z0-9_]{2,10}$/, name);
		}
		assert.equal(specEmojiName('PALADIN', 'holy'), 'pal_hol');
		assert.equal(specEmojiName('HUNTER', 'beast-mastery'), 'hun_bea');
	});
});

describe('role icons', () => {
	it('should load each role icon from the repo as a square 128px PNG', async () => {
		for (const role of ['tank', 'healer', 'dps'] as const) {
			const png = await iconPng(markIcons[role]);
			assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4E, 0x47], role);
			assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [128, 128], role);
		}
	});
});

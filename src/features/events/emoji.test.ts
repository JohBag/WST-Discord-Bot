import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { specEmojiName, specIcons, wowIcons } from './emoji.js';
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
			...Object.values(wowIcons).map(t => t.name),
		];
		assert.equal(new Set(names).size, names.length);
		for (const name of names) {
			assert.match(name, /^[a-z0-9_]{2,10}$/, name);
		}
		assert.equal(specEmojiName('PALADIN', 'holy'), 'pal_hol');
		assert.equal(specEmojiName('HUNTER', 'beast-mastery'), 'hun_bea');
	});
});

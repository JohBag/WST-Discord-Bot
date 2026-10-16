import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getBestPulls } from './embed.js';
import type { Fight } from './raids.js';

function fight(name: string, kill: boolean, fightPercentage: number, difficulty = 4): Fight {
	return { id: 1, name, difficulty, kill, fightPercentage };
}

describe('getBestPulls', () => {
	it('should keep the lowest boss health per boss', () => {
		const pulls = getBestPulls([fight('Boss', false, 40), fight('Boss', false, 12.5), fight('Boss', false, 30)]);
		assert.deepEqual(pulls, { 4: { Boss: 12.5 } });
	});

	it('should record a kill as 0 even after later wipes', () => {
		const pulls = getBestPulls([fight('Boss', true, 0), fight('Boss', false, 20)]);
		assert.equal(pulls[4].Boss, 0);
	});

	it('should separate difficulties', () => {
		const pulls = getBestPulls([fight('Boss', true, 0, 4), fight('Boss', false, 60, 5)]);
		assert.deepEqual(pulls, { 4: { Boss: 0 }, 5: { Boss: 60 } });
	});
});

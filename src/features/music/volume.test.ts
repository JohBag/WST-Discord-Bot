import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { volumeLevels, volumePercent } from './volume.js';

describe('volumeLevels', () => {
	it('should go from 1 to 20 percent in steps of 1', () => {
		assert.equal(volumeLevels.length, 20);
		assert.equal(volumeLevels[0], 1);
		assert.equal(volumeLevels[19], 20);
	});
});

describe('volumePercent', () => {
	it('should round to a whole percent', () => {
		assert.equal(volumePercent(0.07), 7);
		assert.equal(volumePercent(0.25), 25);
	});
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { splitOptions } from '../modules/votes.js';

describe('splitOptions', () => {
	it('should trim options and drop empty ones', () => {
		assert.deepEqual(Object.keys(splitOptions(' Yes , No,, ', false)), ['Yes', 'No']);
	});

	it('should start counts at zero for anonymous votes', () => {
		assert.deepEqual(splitOptions('A,B', true), { A: 0, B: 0 });
	});

	it('should start with no voters for named votes', () => {
		assert.deepEqual(splitOptions('A', false), { A: {} });
	});

	it('should cut options to the 80 character button label limit', () => {
		const [option] = Object.keys(splitOptions('x'.repeat(100), false));
		assert.equal(option.length, 80);
	});

	it('should keep at most 25 options', () => {
		const options = Array.from({ length: 30 }, (_, i) => `Option ${i}`).join(',');
		assert.equal(Object.keys(splitOptions(options, false)).length, 25);
	});
});

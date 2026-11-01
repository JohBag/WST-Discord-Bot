import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stepVolume, volumeLabel } from './volume.js';

describe('stepVolume', () => {
	it('should move one step quieter or louder', () => {
		assert.equal(stepVolume(0.25, 'quieter'), 0.15);
		assert.equal(stepVolume(0.25, 'louder'), 0.4);
	});

	it('should stop at the quietest and loudest steps', () => {
		assert.equal(stepVolume(0.1, 'quieter'), null);
		assert.equal(stepVolume(0.6, 'louder'), null);
	});

	it('should move a volume between steps to the nearest step that way', () => {
		assert.equal(stepVolume(0.3, 'quieter'), 0.25);
		assert.equal(stepVolume(0.3, 'louder'), 0.4);
	});
});

describe('volumeLabel', () => {
	it('should show the volume as a percentage', () => {
		assert.equal(volumeLabel(0.15), '15%');
	});
});

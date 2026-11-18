import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { queueClick, queueEdit } from './post-queue.js';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function recorder() {
	const steps: string[] = [];
	const edit = (name: string, ms = 0) => async () => {
		steps.push(`${name} start`);
		await wait(ms);
		steps.push(`${name} end`);
	};
	const click = (name: string) => ({
		update: async () => { steps.push(`${name} update`); },
		answer: async () => { steps.push(`${name} answer`); },
		redrawAnswered: async () => { steps.push(`${name} redraw`); },
	});
	return { steps, edit, click };
}

describe('post queue', () => {
	it('should redraw a click through its own reply at once when nothing is ahead', async () => {
		const { steps, click } = recorder();
		await queueClick('idle', click('click'));
		assert.deepEqual(steps, ['click update']);
	});

	it('should hold a click until an edit in flight has landed, so the older roster cannot land after it', async () => {
		const { steps, edit, click } = recorder();
		const first = queueEdit('race', edit('edit', 30));
		const second = queueClick('race', click('click'));
		await Promise.all([first, second]);
		assert.deepEqual(steps, ['edit start', 'edit end', 'click update']);
	});

	it('should answer a click that waits too long first, then redraw through the same reply', async () => {
		const { steps, edit, click } = recorder();
		const first = queueEdit('slow', edit('edit', 60));
		const second = queueClick('slow', click('click'), 10);
		await Promise.all([first, second]);
		assert.deepEqual(steps, ['edit start', 'click answer', 'edit end', 'click redraw']);
	});

	it('should fold edits asked for while one waits into that one, but run again for one asked during an edit', async () => {
		const { steps, edit } = recorder();
		const running = queueEdit('fold', edit('a', 20));
		await wait(5);
		const waiting = [queueEdit('fold', edit('b')), queueEdit('fold', edit('c')), queueEdit('fold', edit('d'))];
		await Promise.all([running, ...waiting]);
		assert.deepEqual(steps, ['a start', 'a end', 'b start', 'b end']);
	});

	it('should hold an edit until a click reply in flight has landed', async () => {
		const { steps, edit } = recorder();
		const first = queueClick('behind', {
			update: async () => { steps.push('click start'); await wait(30); steps.push('click end'); },
			answer: async () => {},
			redrawAnswered: async () => {},
		});
		const second = queueEdit('behind', edit('edit'));
		await Promise.all([first, second]);
		assert.deepEqual(steps, ['click start', 'click end', 'edit start', 'edit end']);
	});

	it('should report an early answer that failed, without redrawing, and still run the next redraw', async () => {
		const { steps, edit } = recorder();
		const ahead = queueEdit('lost', edit('ahead', 40));
		const failing = queueClick('lost', {
			update: async () => { steps.push('update'); },
			answer: async () => { throw new Error('Unknown interaction'); },
			redrawAnswered: async () => { steps.push('redraw'); },
		}, 5);
		await assert.rejects(failing, /Unknown interaction/);
		await ahead;
		await queueEdit('lost', edit('after'));
		assert.deepEqual(steps, ['ahead start', 'ahead end', 'after start', 'after end']);
	});

	it('should report a failed click to its caller and still run the next redraw', async () => {
		const { steps, edit } = recorder();
		const failing = queueClick('fail', {
			update: async () => { throw new Error('Unknown interaction'); },
			answer: async () => {},
			redrawAnswered: async () => {},
		});
		await assert.rejects(failing, /Unknown interaction/);
		await queueEdit('fail', edit('after'));
		assert.deepEqual(steps, ['after start', 'after end']);
	});
});

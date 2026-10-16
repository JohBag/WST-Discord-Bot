import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ReplyQueue } from './reply-queue.js';
import type { ReplyReason } from './situation.js';

interface Ping {
	name: string;
	createdTimestamp: number;
}

const ping = (name: string, createdTimestamp: number): Ping => ({ name, createdTimestamp });

// A queue whose replies finish when the test says so, each reading the history at the given time
function setup() {
	const written: string[] = [];
	const pending: { finish: (historyReadAt: number) => void; fail: (error: Error) => void }[] = [];
	const queue = new ReplyQueue<Ping>((trigger, reason: ReplyReason) => {
		written.push(`${trigger.name} (${reason})`);
		return new Promise((resolve, reject) => pending.push({ finish: resolve, fail: reject }));
	});
	// Lets the queue react to a finished reply
	const settle = () => new Promise(resolve => setImmediate(resolve));
	return { queue, written, pending, settle };
}

describe('ReplyQueue', () => {
	it('should not reply again to pings that were in the history already', async () => {
		const { queue, written, pending, settle } = setup();
		const done = queue.add('channel', ping('first', 100), 'direct');
		queue.add('channel', ping('second', 150), 'direct');
		pending[0].finish(200);
		await done;
		assert.deepEqual(written, ['first (direct)']);
	});

	it('should answer pings that came after the history was read, once', async () => {
		const { queue, written, pending, settle } = setup();
		const done = queue.add('channel', ping('first', 100), 'direct');
		queue.add('channel', ping('late', 300), 'direct');
		queue.add('channel', ping('later', 310), 'direct');
		pending[0].finish(200);
		await settle();
		pending[1].finish(400);
		await done;
		assert.deepEqual(written, ['first (direct)', 'later (direct)']);
	});

	it('should skip random replies while busy', async () => {
		const { queue, written, pending, settle } = setup();
		const done = queue.add('channel', ping('random', 100), 'random');
		queue.add('channel', ping('another random', 300), 'random');
		pending[0].finish(200);
		await done;
		assert.deepEqual(written, ['random (random)']);
	});

	it('should handle channels separately', async () => {
		const { queue, written, pending } = setup();
		const a = queue.add('a', ping('in a', 100), 'direct');
		const b = queue.add('b', ping('in b', 100), 'direct');
		pending.forEach(reply => reply.finish(200));
		await Promise.all([a, b]);
		assert.deepEqual(written, ['in a (direct)', 'in b (direct)']);
	});

	it('should accept new replies after one fails', async () => {
		const { queue, written, pending } = setup();
		const failed = queue.add('channel', ping('broken', 100), 'direct');
		pending[0].fail(new Error('API down'));
		await assert.rejects(failed, /API down/);
		const done = queue.add('channel', ping('retry', 300), 'direct');
		pending[1].finish(400);
		await done;
		assert.deepEqual(written, ['broken (direct)', 'retry (direct)']);
	});
});

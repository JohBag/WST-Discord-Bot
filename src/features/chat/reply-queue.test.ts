import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'timers/promises';
import { ReplyQueue } from './reply-queue.js';
import type { ReplyReason } from './situation.js';

interface Ping {
	name: string;
	createdTimestamp: number;
}

const ping = (name: string, createdTimestamp: number): Ping => ({ name, createdTimestamp });

// A queue whose replies finish when the test says so, each having seen messages up to the given time
function setup(gather = { quietMs: 0, maxWaitMs: 0 }) {
	const written: string[] = [];
	const pending: { finish: (seenUntil: number) => void; fail: (error: Error) => void }[] = [];
	const typing = { now: false };
	const queue = new ReplyQueue<Ping>((trigger, reason: ReplyReason) => {
		written.push(`${trigger.name} (${reason})`);
		return new Promise((resolve, reject) => pending.push({ finish: resolve, fail: reject }));
	}, () => typing.now, gather);
	// Lets the queue get to the next reply
	const settle = () => sleep(5);
	return { queue, written, pending, settle, typing };
}

describe('ReplyQueue', () => {
	it('should not reply again to pings the reply already saw', async () => {
		const { queue, written, pending, settle } = setup();
		const done = queue.add('channel', ping('first', 100), 'direct');
		queue.add('channel', ping('second', 150), 'direct');
		await settle();
		pending[0].finish(200);
		await done;
		assert.deepEqual(written, ['first (direct)']);
	});

	it('should answer pings the reply didn\'t see, once', async () => {
		const { queue, written, pending, settle } = setup();
		const done = queue.add('channel', ping('first', 100), 'direct');
		queue.add('channel', ping('late', 300), 'direct');
		queue.add('channel', ping('later', 310), 'direct');
		await settle();
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
		await settle();
		pending[0].finish(200);
		await done;
		assert.deepEqual(written, ['random (random)']);
	});

	it('should handle channels separately', async () => {
		const { queue, written, pending, settle } = setup();
		const a = queue.add('a', ping('in a', 100), 'direct');
		const b = queue.add('b', ping('in b', 100), 'direct');
		await settle();
		pending.forEach(reply => reply.finish(200));
		await Promise.all([a, b]);
		assert.deepEqual(written, ['in a (direct)', 'in b (direct)']);
	});

	it('should accept new replies after one fails', async () => {
		const { queue, written, pending, settle } = setup();
		const failed = queue.add('channel', ping('broken', 100), 'direct');
		await settle();
		pending[0].fail(new Error('API down'));
		await assert.rejects(failed, /API down/);
		const done = queue.add('channel', ping('retry', 300), 'direct');
		await settle();
		pending[1].finish(400);
		await done;
		assert.deepEqual(written, ['broken (direct)', 'retry (direct)']);
	});

	it('should wait until a burst of pings is over before replying', async () => {
		const { queue, written, pending } = setup({ quietMs: 300, maxWaitMs: 5000 });
		const done = queue.add('channel', ping('first', 100), 'direct');
		await sleep(150);
		queue.add('channel', ping('second', 140), 'direct');
		await sleep(250);
		// Past the quiet time after the first ping, but not after the second
		assert.equal(written.length, 0);
		await sleep(200);
		assert.deepEqual(written, ['first (direct)']);
		pending[0].finish(200);
		await done;
	});

	it('should wait while someone is still typing', async () => {
		const { queue, written, pending, typing } = setup({ quietMs: 50, maxWaitMs: 5000 });
		typing.now = true;
		const done = queue.add('channel', ping('first', 100), 'direct');
		await sleep(400);
		assert.equal(written.length, 0);
		typing.now = false;
		queue.add('channel', ping('second thought', 140), 'direct');
		await sleep(400);
		assert.deepEqual(written, ['first (direct)']);
		pending[0].finish(200);
		await done;
	});

	it('should stop waiting for typing after the maximum wait', async () => {
		const { queue, written, pending, typing } = setup({ quietMs: 50, maxWaitMs: 300 });
		typing.now = true;
		const done = queue.add('channel', ping('first', 100), 'direct');
		await sleep(600);
		assert.deepEqual(written, ['first (direct)']);
		pending[0].finish(200);
		await done;
	});

	it('should stop waiting for quiet after the maximum wait', async () => {
		const { queue, written, pending } = setup({ quietMs: 60, maxWaitMs: 100 });
		const done = queue.add('channel', ping('first', 100), 'direct');
		for (let i = 0; i < 6 && written.length === 0; i++) {
			await sleep(30);
			queue.add('channel', ping(`more ${i}`, 110 + i), 'direct');
		}
		assert.deepEqual(written, ['first (direct)']);
		pending[0].finish(1000);
		await done;
	});
});

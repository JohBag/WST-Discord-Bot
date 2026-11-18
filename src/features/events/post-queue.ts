// Every redraw of a sign-up post, whether a message edit or a click's own reply, waits for the one
// before it to land. Each draws the latest saved state when its turn comes, so none can land after a
// newer one with an older roster

interface PostQueue {
	tail: Promise<void>;
	// An edit that hasn't started yet. More edits asked for meanwhile don't queue more: it will show them all
	waitingEdit?: Promise<void>;
}

const queues = new Map<string, PostQueue>();

function queueOf(eventId: string): PostQueue {
	let queue = queues.get(eventId);
	if (!queue) {
		queue = { tail: Promise.resolve() };
		queues.set(eventId, queue);
	}
	return queue;
}

// Runs the redraw once the ones before it are done. A failure reaches the caller, not the next redraw
function enqueue(queue: PostQueue, redraw: () => Promise<void>): Promise<void> {
	const run = queue.tail.then(redraw);
	queue.tail = run.catch(() => {});
	return run;
}

// A message edit of the post. Message edits are rate-limited per channel, so clicks don't use them
export function queueEdit(eventId: string, edit: () => Promise<void>): Promise<void> {
	const queue = queueOf(eventId);
	if (queue.waitingEdit) {
		return queue.waitingEdit;
	}
	const run = enqueue(queue, () => {
		queue.waitingEdit = undefined;
		return edit();
	});
	queue.waitingEdit = run;
	return run;
}

export interface ClickReply {
	// Redraws the post as the reply to the click
	update: () => Promise<unknown>;
	// Answers the click without redrawing
	answer: () => Promise<unknown>;
	// Redraws the post after answer() went first
	redrawAnswered: () => Promise<unknown>;
}

// Discord wants an answer to a click within 3 seconds. A click still waiting its turn by then is
// answered first and redrawn through the same reply once its turn comes
export const answerClickWithin = 2000;

// A click's own reply isn't rate-limited like message edits, so the post redraws through it, in turn
// with every other redraw. Usually nothing is ahead and it shows at once
export function queueClick(eventId: string, reply: ClickReply, within = answerClickWithin): Promise<void> {
	let answered: Promise<unknown> | undefined;
	const timer = setTimeout(() => {
		answered = reply.answer();
		// Its failure is reported when the click's turn comes
		answered.catch(() => {});
	}, within);
	return enqueue(queueOf(eventId), async () => {
		clearTimeout(timer);
		if (answered) {
			await answered;
			await reply.redrawAnswered();
		} else {
			await reply.update();
		}
	});
}

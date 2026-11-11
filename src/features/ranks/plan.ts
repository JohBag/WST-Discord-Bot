export interface Rank {
	id: string;
	name: string;
}

// Up promotes, down demotes
export type Direction = 'up' | 'down';

export type RankChange =
	// roles: the member's whole role list afterwards, changed: the roles added or taken away
	| { from: Rank; to: Rank; roles: string[]; changed: string[] }
	| { error: string };

// One rank up or down from the highest rank the member holds. The new rank replaces every rank role
// they hold, so someone left with both Visitor and Probationer ends up with exactly one rank. Other roles stay.
export function planRankChange(memberName: string, heldRoleIds: string[], ranks: Rank[], direction: Direction): RankChange {
	const current = ranks.map(rank => heldRoleIds.includes(rank.id)).lastIndexOf(true);
	if (current === -1) {
		return { error: `${memberName} isn't a ${listOr(ranks.map(rank => rank.name))}, so there's no rank to ${direction === 'up' ? 'promote' : 'demote'} from.` };
	}
	const next = current + (direction === 'up' ? 1 : -1);
	if (next >= ranks.length) {
		return { error: `${memberName} is already a ${ranks[current].name}, the highest rank.` };
	}
	if (next < 0) {
		return { error: `${memberName} is already a ${ranks[current].name}, the lowest rank.` };
	}

	const to = ranks[next];
	const rankIds = ranks.map(rank => rank.id);
	const removed = heldRoleIds.filter(id => rankIds.includes(id) && id !== to.id);
	const added = heldRoleIds.includes(to.id) ? [] : [to.id];
	return {
		from: ranks[current],
		to,
		roles: [...heldRoleIds.filter(id => !removed.includes(id)), ...added],
		changed: [...removed, ...added],
	};
}

export function listOr(names: string[]): string {
	return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}

export function listAnd(names: string[]): string {
	return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

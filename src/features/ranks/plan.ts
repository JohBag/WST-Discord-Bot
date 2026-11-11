export interface Rank {
	id: string;
	name: string;
}

export type Promotion =
	// roles: the member's whole role list after the promotion, changed: the roles added or taken away
	| { from: Rank; to: Rank; roles: string[]; changed: string[] }
	| { error: string };

// One rank up from the highest rank the member holds. The new rank replaces every lower rank role
// they hold, so someone left with both Visitor and Probationer ends up with only Member. Other roles stay.
export function planPromotion(memberName: string, heldRoleIds: string[], ranks: Rank[]): Promotion {
	const current = ranks.map(rank => heldRoleIds.includes(rank.id)).lastIndexOf(true);
	if (current === -1) {
		return { error: `${memberName} isn't a ${listOr(ranks.map(rank => rank.name))}, so there's no rank to promote from.` };
	}
	if (current === ranks.length - 1) {
		return { error: `${memberName} is already a ${ranks[current].name}.` };
	}
	const to = ranks[current + 1];
	const removed = ranks.slice(0, current + 1).map(rank => rank.id).filter(id => heldRoleIds.includes(id));
	return {
		from: ranks[current],
		to,
		roles: [...heldRoleIds.filter(id => !removed.includes(id)), to.id],
		changed: [...removed, to.id],
	};
}

export function listOr(names: string[]): string {
	return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}

export function listAnd(names: string[]): string {
	return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges overrides onto a base object, returning a new object.
 * Nested objects are merged key by key, so an override only has to name what differs.
 * Arrays and primitives are replaced outright.
 */
export default function merge<T>(base: T, overrides: unknown): T {
	if (!isPlainObject(base) || !isPlainObject(overrides)) {
		return (overrides === undefined ? base : overrides) as T;
	}

	const result: Plain = { ...base };
	for (const [key, value] of Object.entries(overrides)) {
		result[key] = isPlainObject(result[key]) ? merge(result[key], value) : value;
	}

	return result as T;
}

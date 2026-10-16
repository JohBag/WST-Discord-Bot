function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Recursively applies overrides on top of base; arrays and other values are replaced
export default function merge<T>(base: T, overrides: Record<string, unknown>): T {
	const result: Record<string, unknown> = { ...base as Record<string, unknown> };
	for (const [key, value] of Object.entries(overrides)) {
		result[key] = isObject(value) && isObject(result[key]) ? merge(result[key], value) : value;
	}
	return result as T;
}

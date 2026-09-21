/**
 * Unified complexity limit calculation with 10% integer tolerance.
 * Computes limit = Math.floor(max * multiplier * 110 / 100) in integer maths
 * and returns true if value strictly exceeds the limit.
 */
export const exceedsLimit = (value: number, max: number, multiplier = 1): boolean => {
	const limit = Math.floor((max * multiplier * 110) / 100);
	return value > limit;
};

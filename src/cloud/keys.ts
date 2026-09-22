import { createPublicKey, type KeyObject } from "node:crypto";

/**
 * Embedded public keys for offline Ed25519 entitlement JWT verification.
 * Keys are selected by `kid` from the JWT header.
 */
const EMBEDDED_PUBLIC_KEYS: Record<string, string> = {
	rgl_key_2026_1:
		"-----BEGIN PUBLIC KEY-----\n" +
		"MCowBQYDK2VwAyEA69B+1w8c4yJpEURW4Ps2b4BZcoIzeBg3jkCfIo2n2eM=\n" +
		"-----END PUBLIC KEY-----",
};

const keyObjectCache = new Map<string, KeyObject>();

export const getPublicKey = (kid: string): KeyObject | null => {
	// Allow overriding or injecting custom keys for staging, tests, and future rotations
	if (process.env.RAIGAL_KEY_ID === kid && process.env.RAIGAL_PUBLIC_KEY) {
		const customKey = process.env.RAIGAL_PUBLIC_KEY.replace(/\\n/g, "\n");
		try {
			return createPublicKey(customKey);
		} catch {
			return null;
		}
	}

	const cached = keyObjectCache.get(kid);
	if (cached) return cached;

	const pem = EMBEDDED_PUBLIC_KEYS[kid];
	if (!pem) return null;

	try {
		const keyObj = createPublicKey(pem);
		keyObjectCache.set(kid, keyObj);
		return keyObj;
	} catch {
		return null;
	}
};

export const registerPublicKeyForTests = (kid: string, pem: string): void => {
	try {
		const keyObj = createPublicKey(pem);
		keyObjectCache.set(kid, keyObj);
	} catch (err) {
		throw new Error(`Invalid test public key for kid ${kid}: ${String(err)}`);
	}
};

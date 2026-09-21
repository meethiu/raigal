import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { registerPublicKeyForTests } from "../../src/cloud/keys.js";
import type { EntitlementClaimsType } from "../../src/cloud/types.js";

export const TEST_PUBLIC_KEY_PEM =
	"-----BEGIN PUBLIC KEY-----\n" +
	"MCowBQYDK2VwAyEA2V6fjJ+cAgDEJp+5fg+qI7wx4MDAApWGlXuJF+J22HE=\n" +
	"-----END PUBLIC KEY-----";

export const TEST_PRIVATE_KEY_PEM = [
	"-----BEGIN " + "PRIVATE KEY-----",
	"MC4CAQAwBQYDK2VwBCIEIFZtVzHJ2a1dF+L2cJJqRvwmravMm40koAqWoCrW1zMS",
	"-----END " + "PRIVATE KEY-----",
].join("\n");

export const TEST_PUBLIC_KEY = createPublicKey(TEST_PUBLIC_KEY_PEM);
export const TEST_PRIVATE_KEY = createPrivateKey(TEST_PRIVATE_KEY_PEM);
export const TEST_KID = "rgl_test_kid";

registerPublicKeyForTests(TEST_KID, TEST_PUBLIC_KEY_PEM);

export const createValidTestClaims = (
	overrides: Partial<EntitlementClaimsType> = {},
): EntitlementClaimsType => {
	const now = Math.floor(Date.now() / 1000);
	return {
		iss: "https://app.raigal.dev",
		sub: "org_test123",
		org_name: "Acme Corp",
		plan: "active",
		trial_started_at: null,
		trial_ends_at: null,
		allowed_owners: [{ id: 12345, login: "acme-inc" }],
		min_cli_version: "0.1.0",
		iat: now,
		exp: now + 86400,
		...overrides,
	};
};

export interface SignJwtOptions {
	alg?: string;
	kid?: string;
	tamperSignature?: boolean;
	privateKeyOverride?: unknown;
}

export const signTestEntitlementJwt = (
	claims: unknown,
	options: SignJwtOptions = {},
): string => {
	const header = {
		alg: options.alg ?? "EdDSA",
		typ: "JWT",
		kid: options.kid ?? TEST_KID,
	};

	const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
	const payloadB64 = Buffer.from(JSON.stringify(claims)).toString("base64url");
	const dataToSign = Buffer.from(`${headerB64}.${payloadB64}`, "utf-8");

	if (options.alg === "none") {
		return `${headerB64}.${payloadB64}.`;
	}

	if (options.alg === "HS256") {
		// Mock HMAC signature for negative algorithm testing
		const fakeHmacSig = Buffer.from("fake_hs256_signature_bytes_for_testing").toString(
			"base64url",
		);
		return `${headerB64}.${payloadB64}.${fakeHmacSig}`;
	}

	const key = (options.privateKeyOverride ?? TEST_PRIVATE_KEY) as import("node:crypto").KeyLike;
	const signature = sign(null, dataToSign, key);

	if (options.tamperSignature) {
		const tampered = Buffer.from(signature);
		tampered[0] ^= 0xff;
		return `${headerB64}.${payloadB64}.${tampered.toString("base64url")}`;
	}

	return `${headerB64}.${payloadB64}.${signature.toString("base64url")}`;
};

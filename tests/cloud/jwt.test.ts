import { describe, expect, it } from "vitest";
import { verifyEntitlementJwt } from "../../src/cloud/jwt.js";
import {
	createValidTestClaims,
	signTestEntitlementJwt,
	TEST_KID,
} from "./helpers.js";

describe("offline Ed25519 JWT verification", () => {
	it("verifies a valid EdDSA signed entitlement JWT", () => {
		const claims = createValidTestClaims();
		const jwt = signTestEntitlementJwt(claims);

		const verified = verifyEntitlementJwt(jwt);
		expect(verified.sub).toBe("org_test123");
		expect(verified.org_name).toBe("Acme Corp");
		expect(verified.allowed_owners).toEqual([{ id: 12345, login: "acme-inc" }]);
	});

	it("rejects tampered signature", () => {
		const claims = createValidTestClaims();
		const jwt = signTestEntitlementJwt(claims, { tamperSignature: true });

		expect(() => verifyEntitlementJwt(jwt)).toThrowError(/cryptographic signature/i);
	});

	it("rejects unknown kid", () => {
		const claims = createValidTestClaims();
		const jwt = signTestEntitlementJwt(claims, { kid: "unknown_key_999" });

		expect(() => verifyEntitlementJwt(jwt)).toThrowError(/Unknown or untrusted signing key/i);
	});

	it("rejects alg: none", () => {
		const claims = createValidTestClaims();
		const jwt = signTestEntitlementJwt(claims, { alg: "none" });

		expect(() => verifyEntitlementJwt(jwt)).toThrowError(/Unsupported JWT algorithm/i);
	});

	it("rejects alg: HS256", () => {
		const claims = createValidTestClaims();
		const jwt = signTestEntitlementJwt(claims, { alg: "HS256" });

		expect(() => verifyEntitlementJwt(jwt)).toThrowError(/Unsupported JWT algorithm/i);
	});

	it("rejects invalid issuer", () => {
		const claims = createValidTestClaims({ iss: "https://evil.com" as unknown as "https://app.raigal.dev" });
		const jwt = signTestEntitlementJwt(claims);

		expect(() => verifyEntitlementJwt(jwt)).toThrowError(/Untrusted issuer|Invalid entitlement claims/i);
	});

	it("rejects min_cli_version above running version", () => {
		const claims = createValidTestClaims({ min_cli_version: "99.0.0" });
		const jwt = signTestEntitlementJwt(claims);

		expect(() => verifyEntitlementJwt(jwt)).toThrowError(/is below required minimum 99.0.0/i);
	});

	it("rejects expired token when no grace is allowed", () => {
		const now = Math.floor(Date.now() / 1000);
		const claims = createValidTestClaims({
			iat: now - 100000,
			exp: now - 3600, // Expired 1 hour ago
		});
		const jwt = signTestEntitlementJwt(claims);

		expect(() => verifyEntitlementJwt(jwt, { nowSeconds: now, allowGraceSeconds: 0 })).toThrowError(
			/Entitlement expired at/i,
		);
	});

	it("allows expired token within 72h offline grace period", () => {
		const now = Math.floor(Date.now() / 1000);
		const claims = createValidTestClaims({
			iat: now - 100000,
			exp: now - 3600, // Expired 1 hour ago
		});
		const jwt = signTestEntitlementJwt(claims);

		const verified = verifyEntitlementJwt(jwt, {
			nowSeconds: now,
			allowGraceSeconds: 72 * 3600,
		});
		expect(verified.sub).toBe("org_test123");
	});

	it("rejects token expired beyond 72h offline grace period", () => {
		const now = Math.floor(Date.now() / 1000);
		const claims = createValidTestClaims({
			iat: now - 400000,
			exp: now - (73 * 3600), // Expired 73 hours ago
		});
		const jwt = signTestEntitlementJwt(claims);

		expect(() =>
			verifyEntitlementJwt(jwt, {
				nowSeconds: now,
				allowGraceSeconds: 72 * 3600,
			}),
		).toThrowError(/expired beyond offline grace period/i);
	});
});

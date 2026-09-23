import type { Diagnostic } from "../engines/types.js";
import { FIXED_SECRET_DIAGNOSTIC_MESSAGE, isSecretClassRule } from "../utils/mask-secrets.js";

/**
 * Pure deterministic formatter for diagnostic messages.
 * Secret-class rules (or redactSource: true) unconditionally return FIXED_SECRET_DIAGNOSTIC_MESSAGE.
 * Non-secret rules return diagnostic.message (clamped to max 500 chars).
 */
export const formatFindingMessage = (
	diagnostic: Pick<Diagnostic, "rule" | "message" | "redactSource">,
): string => {
	if (diagnostic.redactSource || isSecretClassRule(diagnostic.rule)) {
		return FIXED_SECRET_DIAGNOSTIC_MESSAGE;
	}
	return diagnostic.message.slice(0, 500);
};

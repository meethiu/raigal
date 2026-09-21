interface SecretMaskPattern {
	kind: string;
	pattern: RegExp;
	replaceGroup?: number;
}

const BEGIN_KEY = "-----BEGIN " + "(?:RSA |EC |DSA )?" + "PRIVATE KEY-----";
const END_KEY = "-----END " + "(?:RSA |EC |DSA )?" + "PRIVATE KEY-----";

const MASK_PATTERNS: SecretMaskPattern[] = [
	// Private key blocks
	{
		kind: "private_key",
		pattern: new RegExp(`${BEGIN_KEY}[\\s\\S]*?${END_KEY}`, "g"),
	},
	{
		kind: "private_key",
		pattern: new RegExp(BEGIN_KEY, "g"),
	},
	// AWS Access Key
	{
		kind: "aws",
		pattern: /\bAKIA[0-9A-Z]{16}\b/g,
	},
	// GitHub tokens
	{
		kind: "github",
		pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g,
	},
	// Slack tokens
	{
		kind: "slack",
		pattern: /\bxox[baprs]-[A-Za-z0-9-]+\b/g,
	},
	// Database connection strings with credentials
	{
		kind: "database_url",
		pattern: /(?:mongodb(?:\+srv)?|postgres|mysql|redis):\/\/[^:@/"'`\s]+:[^@"'`\s]+@[^"'`\s]+/gi,
	},
	// JWT tokens
	{
		kind: "jwt",
		pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
	},
	// Generic passwords / secrets / keys assignments
	{
		kind: "password",
		pattern:
			/((?:password|passwd|pwd|secret|key|apikey|api[_-]?key|token|bearer)\s*[:=]\s*(?:\\?["'])?)([\w\-~@#$%^&*+=/]{8,})((?:\\?["'])?)/gi,
		replaceGroup: 2,
	},
	// AWS Secret Key assignments
	{
		kind: "aws_secret",
		pattern:
			/((?:aws[_-]?secret|secret[_-]?key)\s*[:=]\s*(?:\\?["'])?)([A-Za-z0-9/+=]{40})((?:\\?["'])?)/gi,
		replaceGroup: 2,
	},
	// Generic API keys
	{
		kind: "api_key",
		pattern: /((?:api[_-]?key|apikey)\s*[:=]\s*(?:\\?["'])?)([A-Za-z0-9_-]{20,})((?:\\?["'])?)/gi,
		replaceGroup: 2,
	},
	// Generic tokens
	{
		kind: "token",
		pattern: /((?:token|bearer)\s*[:=]\s*(?:\\?["'])?)([A-Za-z0-9_-]{20,})((?:\\?["'])?)/gi,
		replaceGroup: 2,
	},
];

export const isSecretClassRule = (rule: string): boolean => {
	const lower = rule.toLowerCase();
	return (
		lower === "security/hardcoded-secret" ||
		lower.includes("secret") ||
		lower.includes("credential") ||
		lower.includes("private-key")
	);
};

export const FIXED_SECRET_DIAGNOSTIC_MESSAGE =
	"Hardcoded credential. Rotate it and load it from the environment.";

export const maskSecrets = (text: string): string => {
	if (!text || typeof text !== "string") return text;
	let result = text;

	for (const { kind, pattern, replaceGroup } of MASK_PATTERNS) {
		const regex = new RegExp(pattern.source, pattern.flags);
		if (replaceGroup !== undefined) {
			result = result.replace(regex, (match, prefix, secret, suffix) => {
				return `${prefix}[REDACTED:${kind}]${suffix}`;
			});
		} else {
			result = result.replace(regex, `[REDACTED:${kind}]`);
		}
	}

	return result;
};

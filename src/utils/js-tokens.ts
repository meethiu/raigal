import { consumeQuotedString } from "./string-literals.js";

type TokenKind = "code" | "string" | "template" | "comment" | "regex" | "jsx-text";

export interface SourceToken {
	kind: TokenKind;
	start: number;
	end: number;
	text: string;
}

interface QuasiScan {
	text: string;
	end: number;
	openedInterp: boolean;
	resumeAt: number;
}

interface JsxScanResult {
	tokens: SourceToken[];
	resumeAt: number;
}

const REGEX_PRECEDING_KEYWORDS = new Set([
	"return",
	"typeof",
	"instanceof",
	"in",
	"of",
	"new",
	"delete",
	"void",
	"do",
	"else",
	"yield",
	"await",
	"case",
	"throw",
]);

const regexAllowedAt = (content: string, slashIndex: number): boolean => {
	let p = slashIndex - 1;
	while (
		p >= 0 &&
		(content[p] === " " || content[p] === "\t" || content[p] === "\n" || content[p] === "\r")
	) {
		p--;
	}
	if (p < 0) return true;
	const ch = content[p];
	if (ch === ")" || ch === "]" || ch === "}" || ch === '"' || ch === "'" || ch === "`") {
		return false;
	}
	if (/[A-Za-z0-9_$]/.test(ch)) {
		let w = p;
		while (w >= 0 && /[A-Za-z0-9_$]/.test(content[w])) w--;
		return REGEX_PRECEDING_KEYWORDS.has(content.slice(w + 1, p + 1));
	}
	return true;
};

const consumeRegex = (content: string, start: number): number => {
	const len = content.length;
	let i = start + 1;
	let inClass = false;
	while (i < len) {
		const c = content[i];
		if (c === "\\") {
			i += 2;
			continue;
		}
		if (c === "\n") return -1;
		if (c === "[") inClass = true;
		else if (c === "]") inClass = false;
		else if (c === "/" && !inClass) {
			i++;
			while (i < len && /[a-z]/i.test(content[i])) i++;
			return i;
		}
		i++;
	}
	return -1;
};

const scanTemplateQuasi = (content: string, start: number): QuasiScan => {
	const len = content.length;
	let k = start;
	let openedInterp = false;
	while (k < len) {
		if (content[k] === "\\" && k + 1 < len) {
			k += 2;
			continue;
		}
		if (content[k] === "`") {
			k++;
			break;
		}
		if (content[k] === "$" && k + 1 < len && content[k + 1] === "{") {
			openedInterp = true;
			break;
		}
		k++;
	}
	return {
		text: content.slice(start, k),
		end: openedInterp ? k + 2 : k,
		openedInterp,
		resumeAt: openedInterp ? k + 2 : k,
	};
};

const scanComment = (content: string, i: number, next: string): SourceToken | null => {
	const len = content.length;
	if (content[i] === "/" && next === "/") {
		let k = i + 2;
		while (k < len && content[k] !== "\n") k++;
		return { kind: "comment", start: i, end: k, text: content.slice(i, k) };
	}
	if (content[i] === "/" && next === "*") {
		let k = i + 2;
		while (k < len - 1 && !(content[k] === "*" && content[k + 1] === "/")) k++;
		if (k < len - 1) k += 2;
		else k = len;
		return { kind: "comment", start: i, end: k, text: content.slice(i, k) };
	}
	return null;
};

const scanJsxElement = (content: string, i: number, next: string): JsxScanResult | null => {
	if (content[i] !== "<" || (!/[a-zA-Z>]/.test(next) && next !== "/")) return null;
	const len = content.length;
	let k = i;
	while (k < len && content[k] !== ">") {
		if (content[k] === '"' || content[k] === "'") {
			k = consumeQuotedString(content, k, content[k]);
		} else {
			k++;
		}
	}
	if (k >= len || content[k] !== ">") return null;
	const tagHeader = content.slice(i, k + 1);
	if (tagHeader.endsWith("/>") || tagHeader.startsWith("</")) return null;

	const tokens: SourceToken[] = [{ kind: "code", start: i, end: k + 1, text: tagHeader }];
	let textIdx = k + 1;
	const textStart = textIdx;
	while (textIdx < len && content[textIdx] !== "<" && content[textIdx] !== "{") {
		textIdx++;
	}
	if (textIdx > textStart) {
		tokens.push({
			kind: "jsx-text",
			start: textStart,
			end: textIdx,
			text: content.slice(textStart, textIdx),
		});
	}
	return { tokens, resumeAt: textIdx };
};

const isJsxExt = (ext: string): boolean => ext === ".jsx" || ext === ".tsx";

export const tokenizeJs = (content: string, ext = ".ts"): SourceToken[] => {
	const tokens: SourceToken[] = [];
	const len = content.length;
	const tplStack: number[] = [];
	const enableJsx = isJsxExt(ext);
	let i = 0;

	while (i < len) {
		const c = content[i];
		const next = i + 1 < len ? content[i + 1] : "";

		if (tplStack.length > 0 && c === "}" && tplStack[tplStack.length - 1] === 0) {
			tplStack.pop();
			const scan = scanTemplateQuasi(content, i + 1);
			tokens.push({ kind: "template", start: i, end: scan.end, text: scan.text });
			if (scan.openedInterp) tplStack.push(0);
			i = scan.resumeAt;
			continue;
		}

		if (c === '"' || c === "'") {
			const strEnd = consumeQuotedString(content, i, c);
			tokens.push({ kind: "string", start: i, end: strEnd, text: content.slice(i, strEnd) });
			i = strEnd;
			continue;
		}

		if (c === "`") {
			const scan = scanTemplateQuasi(content, i + 1);
			tokens.push({ kind: "template", start: i, end: scan.end, text: scan.text });
			if (scan.openedInterp) tplStack.push(0);
			i = scan.resumeAt;
			continue;
		}

		const commentToken = scanComment(content, i, next);
		if (commentToken) {
			tokens.push(commentToken);
			i = commentToken.end;
			continue;
		}

		if (c === "/" && regexAllowedAt(content, i)) {
			const regexEnd = consumeRegex(content, i);
			if (regexEnd !== -1) {
				tokens.push({ kind: "regex", start: i, end: regexEnd, text: content.slice(i, regexEnd) });
				i = regexEnd;
				continue;
			}
		}

		if (enableJsx) {
			const jsx = scanJsxElement(content, i, next);
			if (jsx) {
				tokens.push(...jsx.tokens);
				i = jsx.resumeAt;
				continue;
			}
		}

		if (tplStack.length > 0) {
			if (c === "{") tplStack[tplStack.length - 1]++;
			else if (c === "}") tplStack[tplStack.length - 1]--;
		}

		tokens.push({ kind: "code", start: i, end: i + 1, text: c });
		i++;
	}

	return tokens;
};

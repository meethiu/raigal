import { style, type Theme, type Token } from "./theme.js";

const COMMAND_TOKEN = /(?<![.\w/-])(?:raigal|aislop)(?![.\w/-])/g;

export const highlightRaigal = (text: string, theme: Theme, baseToken?: Token): string => {
	let lastIndex = 0;
	let out = "";
	for (const match of text.matchAll(COMMAND_TOKEN)) {
		const index = match.index ?? 0;
		if (index > lastIndex) {
			const chunk = text.slice(lastIndex, index);
			out += baseToken ? style(theme, baseToken, chunk) : chunk;
		}
		out += style(theme, "accent", match[0]);
		lastIndex = index + match[0].length;
	}
	if (lastIndex === 0) return baseToken ? style(theme, baseToken, text) : text;
	const tail = text.slice(lastIndex);
	return out + (baseToken ? style(theme, baseToken, tail) : tail);
};

export const highlightAislop = highlightRaigal;

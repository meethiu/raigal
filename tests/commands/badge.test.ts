import { describe, expect, it } from "vitest";
import { renderBadgeOutput } from "../../src/commands/badge.js";
import { stripAnsi as strip } from "../helpers/ansi.js";

describe("renderBadgeOutput", () => {
	it("emits the markdown snippet pointing at badges.raigal.dev and the project page", () => {
		const out = strip(
			renderBadgeOutput({
				owner: "scanaislop",
				repo: "aislop",
				svgUrl: "https://badges.raigal.dev/score/scanaislop/aislop.svg",
				pageUrl: "https://raigal.dev/scanaislop/aislop",
			}),
		);

		expect(out).toContain("Badge");
		expect(out).toMatch(/Repository\s+scanaislop\/aislop/);
		expect(out).toMatch(
			/Badge URL\s+https:\/\/badges\.raigal\.dev\/score\/scanaislop\/aislop\.svg/,
		);
		expect(out).toMatch(/Page\s+https:\/\/raigal\.dev\/scanaislop\/aislop/);
		expect(out).toContain("Markdown");
		expect(out).toMatch(/README\s+\[!\[(raigal|aislop)\]/);
		expect(out).toContain("Next");
		expect(out).toContain("https://badges.raigal.dev/score/scanaislop/aislop.svg");
		expect(out).toMatch(
			/\[!\[(raigal|aislop)\]\(https:\/\/badges\.raigal\.dev\/score\/scanaislop\/aislop\.svg\)\]\(https:\/\/raigal\.dev\/scanaislop\/aislop\)/,
		);
		expect(out).toMatch(/Add\s+put the README markdown near your project title/);
		expect(out).toMatch(/Refresh\s+run a public scan to update the score behind the badge/);
	});

	it("renders consistently for any owner/repo pair", () => {
		const out = strip(
			renderBadgeOutput({
				owner: "vercel",
				repo: "next.js",
				svgUrl: "https://badges.raigal.dev/score/vercel/next.js.svg",
				pageUrl: "https://raigal.dev/vercel/next.js",
			}),
		);

		expect(out).toMatch(/Repository\s+vercel\/next\.js/);
		expect(out).toMatch(
			/\[!\[(raigal|aislop)\]\(https:\/\/badges\.raigal\.dev\/score\/vercel\/next\.js\.svg\)\]\(https:\/\/raigal\.dev\/vercel\/next\.js\)/,
		);
	});
});

import fs from "node:fs";
import { requestApi } from "../cloud/client.js";
import { detectRepoRef } from "../cloud/context.js";
import { getActiveToken } from "../cloud/credentials.js";
import { log } from "../ui/logger.js";

interface ReportPrClosedOptions {
	prNumber?: number;
	merged?: boolean;
}

export const reportPrClosedCommand = async (
	options: ReportPrClosedOptions = {},
): Promise<{ exitCode: number }> => {
	try {
		let prNumber = options.prNumber;
		let merged = options.merged ?? false;

		const eventPath = process.env.GITHUB_EVENT_PATH;
		if (eventPath && fs.existsSync(eventPath)) {
			try {
				const eventData = JSON.parse(fs.readFileSync(eventPath, "utf-8")) as {
					pull_request?: { number?: number; merged?: boolean };
					number?: number;
				};
				if (typeof eventData.pull_request?.number === "number") {
					prNumber = eventData.pull_request.number;
				} else if (typeof eventData.number === "number") {
					prNumber = eventData.number;
				}
				if (typeof eventData.pull_request?.merged === "boolean") {
					merged = eventData.pull_request.merged;
				}
			} catch {
				// skip JSON parse errors
			}
		}

		if (!prNumber) {
			log.info("No pull request number detected to report closed.");
			return { exitCode: 0 };
		}

		const repo = detectRepoRef(process.cwd());
		if (!repo) {
			log.info("No repository detected.");
			return { exitCode: 0 };
		}

		const token = getActiveToken()?.token;

		await requestApi("/v1/pr-events", {
			method: "POST",
			token,
			body: {
				repo,
				pr_number: prNumber,
				event: "closed",
				merged,
			},
			timeoutMs: 3000,
		});

		log.info(`Reported PR #${prNumber} as ${merged ? "merged" : "closed"}.`);
		return { exitCode: 0 };
	} catch {
		// Non-fatal status ping
		return { exitCode: 0 };
	}
};

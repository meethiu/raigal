export const isGitHubActions = (): boolean =>
	Boolean(process.env.GITHUB_ACTIONS === "true" || process.env.GITHUB_ACTIONS === "1");

export const fetchGitHubOidcToken = async (): Promise<string | undefined> => {
	const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
	const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

	if (!requestUrl || !requestToken) return undefined;

	try {
		const targetAudience = process.env.RAIGAL_AUDIENCE?.trim() || "https://app.raigal.dev";
		const audience = encodeURIComponent(targetAudience);
		const url = `${requestUrl}&audience=${audience}`;
		const response = await fetch(url, {
			headers: {
				Authorization: `bearer ${requestToken}`,
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(3000),
		});

		if (!response.ok) return undefined;

		const json = (await response.json()) as { value?: string };
		return typeof json?.value === "string" ? json.value : undefined;
	} catch {
		return undefined;
	}
};

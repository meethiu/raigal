import fs from "node:fs";
import path from "node:path";

export const atomicWrite = (targetPath: string, content: string): void => {
	const dir = path.dirname(targetPath);
	fs.mkdirSync(dir, { recursive: true });
	const rand = Math.random().toString(36).slice(2, 10);
	const tmp = path.join(dir, `.aislop-tmp-${process.pid}-${rand}`);
	fs.writeFileSync(tmp, content, "utf-8");
	try {
		fs.renameSync(tmp, targetPath);
	} catch (err: unknown) {
		const code = (err as { code?: string })?.code;
		if (code === "EPERM" || code === "EBUSY") {
			fs.copyFileSync(tmp, targetPath);
			try {
				fs.unlinkSync(tmp);
			} catch {
				// ignore temp cleanup error
			}
		} else {
			throw err;
		}
	}
};

export const readIfExists = (targetPath: string): string | null => {
	try {
		return fs.readFileSync(targetPath, "utf-8");
	} catch {
		return null;
	}
};

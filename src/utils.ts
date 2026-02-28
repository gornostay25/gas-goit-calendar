import { getSyncFutureDays, getSyncPastDays } from "./config/properties";

export type GoitSyncWindow = {
	start: Date;
	end: Date;
};

export function getSyncWindow(
	pastDays: number = getSyncPastDays(),
	futureDays: number = getSyncFutureDays(),
): GoitSyncWindow {
	const now = new Date();
	const start = new Date(now.getTime());
	start.setDate(start.getDate() - pastDays);
	const end = new Date(now.getTime());
	end.setDate(end.getDate() + futureDays);

	return { start, end };
}

export function log(log: unknown) {
	Logger.log(JSON.stringify(log, null, 2));
}

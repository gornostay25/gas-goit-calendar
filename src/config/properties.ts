const DEFAULT_SYNC_PAST_DAYS = 7;
const DEFAULT_SYNC_FUTURE_DAYS = 60;

export const PROPERTY_KEYS = {
	SYNC_PAST_DAYS: "SYNC_PAST_DAYS",
	SYNC_FUTURE_DAYS: "SYNC_FUTURE_DAYS",
	GOIT_GROUP_IDS: "GOIT_GROUP_IDS",
	GOIT_ACCESS_TOKEN: "GOIT_ACCESS_TOKEN",
	GOIT_REFRESH_TOKEN: "GOIT_REFRESH_TOKEN",
} as const;

export function getScriptProperties(): GoogleAppsScript.Properties.Properties {
	return PropertiesService.getScriptProperties();
}

export function getOptionalProperty(key: string): string | null {
	return getScriptProperties().getProperty(key);
}

export function setProperties(values: Record<string, string>): void {
	getScriptProperties().setProperties(values, false);
}

export function getRequiredProperty(key: string): string {
	const value = getOptionalProperty(key)?.trim();
	if (!value) {
		throw new Error(`Missing required Script Property: ${key}`);
	}
	return value;
}

export function getGoitGroupIds(): string[] {
	const raw = getOptionalProperty(PROPERTY_KEYS.GOIT_GROUP_IDS);
	if (!raw) {
		return [];
	}

	return raw
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

export function getSyncPastDays(): number {
	return getIntegerProperty(
		PROPERTY_KEYS.SYNC_PAST_DAYS,
		DEFAULT_SYNC_PAST_DAYS,
	);
}

export function getSyncFutureDays(): number {
	return getIntegerProperty(
		PROPERTY_KEYS.SYNC_FUTURE_DAYS,
		DEFAULT_SYNC_FUTURE_DAYS,
	);
}

function getIntegerProperty(key: string, fallback: number): number {
	const value = getOptionalProperty(key);
	if (!value) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

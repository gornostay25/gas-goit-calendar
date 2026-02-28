type GoitParticipant = {
	username?: string;
	fullName?: string;
};

type GoitResource = {
	id?: number | string;
	type?: string;
	groupEventTimeZone?: string;
	links?: string[];
	courseName?: string;
	moduleName?: string;
	groupName?: string;
	tutorFirstName?: string;
	tutorLastName?: string;
	participants?: GoitParticipant[];
};

type GoitGroupEventInfo = {
	title?: string | null;
	allDay?: boolean;
	start: string;
	end: string;
	invisible?: boolean;
	resource?: GoitResource;
};

type GoitApiResponse = {
	success?: boolean;
	groupEventInfos?: GoitGroupEventInfo[];
	error?: string;
};

export type NormalizedGoitEvent = {
	goitEventId: string;
	title: string;
	start: Date;
	end: Date;
	isAllDay: boolean;
	timeZone: string;
	description: string;
	sourceType: string;
	links: string[];
};

export function mapGoitEventsResponse(body: string): NormalizedGoitEvent[] {
	let payload: GoitApiResponse;
	try {
		payload = JSON.parse(body);
	} catch (error) {
		throw new Error(`GoIT API returned invalid JSON: ${String(error)}`);
	}

	if (!payload.success) {
		throw new Error(
			`GoIT API returned an error: ${payload.error ?? "Unknown error"}`,
		);
	}

	const infos = payload.groupEventInfos ?? [];
	return infos
		.filter((raw) => !raw.invisible)
		.map((raw) => normalizeGoitEvent(raw, getStableGoitEventId(raw)));
}

function normalizeGoitEvent(
	raw: GoitGroupEventInfo,
	goitEventId: string,
): NormalizedGoitEvent {
	const resource = raw.resource ?? {};
	const title = raw.title?.trim() || inferFallbackTitle(resource, goitEventId);
	const timeZone = normalizeGoitTimeZone(resource.groupEventTimeZone);
	const sourceType = resource.type || "unknown";
	const links = resource.links ?? [];

	return {
		goitEventId,
		title,
		start: parseGoitDateTime(raw.start, timeZone),
		end: parseGoitDateTime(raw.end, timeZone),
		isAllDay: Boolean(raw.allDay),
		timeZone,
		sourceType,
		links,
		description: buildDescription(raw, goitEventId),
	};
}

const DEFAULT_GOIT_TIME_ZONE = "Europe/Kyiv";
const LEGACY_KYIV_TIME_ZONE = "Europe/Kiev";
function normalizeGoitTimeZone(timeZone?: string): string {
	const normalized = timeZone?.trim() || DEFAULT_GOIT_TIME_ZONE;
	if (normalized === LEGACY_KYIV_TIME_ZONE) {
		return DEFAULT_GOIT_TIME_ZONE;
	}

	try {
		Utilities.formatDate(new Date(), normalized, "Z");
		return normalized;
	} catch (error) {
		Logger.log(
			`Unknown GoIT timezone "${normalized}", fallback to ${DEFAULT_GOIT_TIME_ZONE}: ${String(error)}`,
		);
		return DEFAULT_GOIT_TIME_ZONE;
	}
}

function parseGoitDateTime(rawValue: string, timeZone: string): Date {
	if (hasExplicitUtcOffset(rawValue)) {
		return new Date(rawValue);
	}

	return parseNaiveGoitDateTime(rawValue, timeZone);
}

function hasExplicitUtcOffset(value: string): boolean {
	return /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
}

const NAIVE_DATETIME_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/;
function parseNaiveGoitDateTime(value: string, timeZone: string): Date {
	const match = value.match(NAIVE_DATETIME_PATTERN);
	if (!match) {
		throw new Error(`Unsupported GoIT datetime format: ${value}`);
	}

	const [_, year, month, day, hour, minute, second = "0", millisecond = ""] =
		match;

	const normalizedMs = millisecond ? millisecond.padEnd(3, "0") : "";
	const normalizedValue = normalizedMs
		? `${year}-${month}-${day}T${hour}:${minute}:${second}.${normalizedMs}`
		: `${year}-${month}-${day}T${hour}:${minute}:${second}`;
	const format = normalizedMs
		? "yyyy-MM-dd'T'HH:mm:ss.SSS"
		: "yyyy-MM-dd'T'HH:mm:ss";
	return Utilities.parseDate(normalizedValue, timeZone, format);
}

function getStableGoitEventId(raw: GoitGroupEventInfo): string {
	const FAILED_TYPES = [
		"deadlineAllCourseHomeworks",
		"courseEnd",
		"courseStart",
	];
	const rawId = raw.resource?.id;
	const type = raw.resource?.type;
	if (rawId && type && !FAILED_TYPES.includes(type)) {
		return `goit:${String(rawId)}`;
	}

	const fallbackSeed = JSON.stringify({
		title: raw.title ?? "",
		start: raw.start,
		end: raw.end,
		type: raw.resource?.type ?? "unknown",
		moduleName: raw.resource?.moduleName ?? "",
	});
	const digest = Utilities.computeDigest(
		Utilities.DigestAlgorithm.MD5,
		fallbackSeed,
	);
	return `goit:fallback:${Utilities.base64EncodeWebSafe(digest)}`;
}

function inferFallbackTitle(
	resource: GoitResource,
	goitEventId: string,
): string {
	const typeLabel = getTypeLabel(resource.type);
	if (typeLabel && resource.courseName) {
		return `${typeLabel} - ${resource.courseName}`;
	}
	if (typeLabel) {
		return typeLabel;
	}
	if (resource.courseName) {
		return resource.courseName;
	}
	if (resource.moduleName) {
		return resource.moduleName;
	}
	return `GoIT event (${goitEventId})`;
}
const TITLE_BY_TYPE: Record<string, string> = {
	courseStart: "Course Start",
	courseEnd: "Course End",
	lessonHomeworkDeadline: "Homework Deadline",
	deadlineAllCourseHomeworks: "All Course Homeworks Deadline",
	english: "English",
};
function getTypeLabel(sourceType?: string): string | null {
	if (!sourceType) {
		return null;
	}
	return TITLE_BY_TYPE[sourceType] ?? sourceType;
}

function buildDescription(
	raw: GoitGroupEventInfo,
	goitEventId: string,
): string {
	const resource = raw.resource ?? {};
	const tutorName = [resource.tutorFirstName, resource.tutorLastName]
		.filter(Boolean)
		.join(" ");
	const lines = [
		"Source: GoIT",
		resource.type ? `Type: ${resource.type}` : "",
		resource.courseName ? `Course: ${resource.courseName}` : "",
		resource.moduleName ? `Module: ${resource.moduleName}` : "",
		resource.groupName ? `Group: ${resource.groupName}` : "",
		tutorName ? `Tutor: ${tutorName}` : "",
		`Event ID: ${goitEventId}`,
	].filter(Boolean);

	const links = (resource.links ?? []).map((link) => `Link: ${link}`);
	return [...lines, ...links].join("\n");
}

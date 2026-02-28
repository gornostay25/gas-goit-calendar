import { getAuthTokens, setAuthTokens } from "../../auth/tokens";
import { mapGoitEventsResponse, type NormalizedGoitEvent } from "./mapper";

const LIST_ALLOWED_EVENTS_URL =
	"https://api.edu.goit.global/api/v1/groupEvent/listAllowedEvents";
const REFRESH_TOKEN_URL = "https://api.edu.goit.global/api/v1/auth/refresh";

type HttpMethod = "get" | "post";

type HttpResponse = {
	statusCode: number;
	body: string;
};

type RefreshResponse = {
	success?: boolean;
	error?: string;
	accessToken?: string;
	refreshToken?: string;
};

export type GoitFetchParams = {
	start: Date;
	end: Date;
	groupIds?: string[];
};

export function fetchGoitCalendarEvents(
	params: GoitFetchParams,
): NormalizedGoitEvent[] {
	const url = buildGoitEventsUrl(
		params.start,
		params.end,
		params.groupIds ?? [],
	);
	const response = authorizedRequest("get", url);
	return mapGoitEventsResponse(response.body);
}

function authorizedRequest(method: HttpMethod, url: string): HttpResponse {
	const tokens = getAuthTokens();
	const initialResponse = requestWithAccessToken(
		method,
		url,
		tokens.accessToken,
	);
	if (initialResponse.statusCode !== 401) {
		ensureSuccess(initialResponse, url);
		return initialResponse;
	}

	const refreshedTokens = refreshTokens(tokens.refreshToken);
	setAuthTokens(refreshedTokens);

	const retriedResponse = requestWithAccessToken(
		method,
		url,
		refreshedTokens.accessToken,
	);
	ensureSuccess(retriedResponse, url);
	return retriedResponse;
}

function refreshTokens(refreshToken: string): {
	accessToken: string;
	refreshToken: string;
} {
	const response = request("post", REFRESH_TOKEN_URL, {
		Cookie: `refreshToken=${refreshToken}`,
	});
	ensureSuccess(response, REFRESH_TOKEN_URL);

	let payload: RefreshResponse;
	try {
		payload = JSON.parse(response.body);
	} catch (error) {
		throw new Error(`GoIT refresh returned invalid JSON: ${String(error)}`);
	}

	const accessToken = payload.accessToken?.trim();
	const nextRefreshToken = payload.refreshToken?.trim();
	if (!accessToken || !nextRefreshToken) {
		throw new Error("GoIT refresh response does not contain valid tokens");
	}

	return { accessToken, refreshToken: nextRefreshToken };
}

function requestWithAccessToken(
	method: HttpMethod,
	url: string,
	accessToken: string,
): HttpResponse {
	return request(method, url, {
		Authorization: `Bearer ${accessToken}`,
	});
}

function request(
	method: HttpMethod,
	url: string,
	headers: Record<string, string>,
): HttpResponse {
	const response = UrlFetchApp.fetch(url, {
		method,
		contentType: "application/json",
		muteHttpExceptions: true,
		headers,
	});

	return {
		statusCode: response.getResponseCode(),
		body: response.getContentText(),
	};
}

function ensureSuccess(response: HttpResponse, endpoint: string): void {
	if (response.statusCode >= 400) {
		throw new Error(
			`GoIT API failed for ${endpoint} with status ${response.statusCode}: ${response.body.slice(0, 500)}`,
		);
	}
}

function buildGoitEventsUrl(
	start: Date,
	end: Date,
	groupIds: string[],
): string {
	const params = [
		`startUtcDateTime=${encodeURIComponent(start.toISOString())}`,
		`endUtcDateTime=${encodeURIComponent(end.toISOString())}`,
		`groupIds=${encodeURIComponent(groupIds.join(","))}`,
	].join("&");

	return `${LIST_ALLOWED_EVENTS_URL}?${params}`;
}

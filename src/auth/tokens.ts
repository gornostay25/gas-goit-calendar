import {
	PROPERTY_KEYS,
	getRequiredProperty,
	setProperties,
} from "../config/properties";

type AuthTokens = {
	accessToken: string;
	refreshToken: string;
};

export function getAuthTokens(): AuthTokens {
	return {
		accessToken: getRequiredProperty(PROPERTY_KEYS.GOIT_ACCESS_TOKEN),
		refreshToken: getRequiredProperty(PROPERTY_KEYS.GOIT_REFRESH_TOKEN),
	};
}

export function setAuthTokens(tokens: AuthTokens): void {
	setProperties({
		[PROPERTY_KEYS.GOIT_ACCESS_TOKEN]: tokens.accessToken,
		[PROPERTY_KEYS.GOIT_REFRESH_TOKEN]: tokens.refreshToken,
	});
}

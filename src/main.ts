import { fetchGoitCalendarEvents } from "./integrations/goit";
import { ensureGoitCalendar, reconcileGoitEvents } from "./sync";
import { getSyncWindow, log } from "./utils";
import {
	DEFAULT_EVENT_REMINDER_OPTIONS,
	getGoitGroupIds,
	getOptionalJSONProperty,
	getOptionalProperty,
	PROPERTY_KEYS,
	setProperties,
	type EventReminderOptions,
} from "./config/properties";

const SYNC_LOCK_WAIT_MS = 5000;

function runSyncHandler() {
	const lock = LockService.getScriptLock();
	if (!lock.tryLock(SYNC_LOCK_WAIT_MS)) {
		log({
			message: "GoIT sync skipped",
			data: { reason: "Another sync is already running" },
		});
		return;
	}

	const startedAt = new Date();
	const window = getSyncWindow();

	try {
		const calendar = ensureGoitCalendar();
		const goitEvents = fetchGoitCalendarEvents({
			start: window.start,
			end: window.end,
			groupIds: getGoitGroupIds(),
		});
		const summary = reconcileGoitEvents(calendar, goitEvents, window);

		log({
			message: "GoIT sync completed",
			data: {
				calendarId: calendar.getId(),
				rangeStart: window.start.toISOString(),
				rangeEnd: window.end.toISOString(),
				fetched: goitEvents.length,
				...summary,
				elapsedMs: Date.now() - startedAt.getTime(),
			},
		});
	} catch (error) {
		log({
			message: "GoIT sync failed",
			data: {
				error: String(error),
				elapsedMs: Date.now() - startedAt.getTime(),
			},
		});
		throw error;
	} finally {
		lock.releaseLock();
	}
}

function setupTrigger() {
	const RUN_SYNC_HANDLER = runSyncHandler.name;
	const existing = ScriptApp.getProjectTriggers().some(
		(trigger) =>
			trigger.getHandlerFunction() === RUN_SYNC_HANDLER &&
			trigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK,
	);

	if (existing) {
		log(`Clock trigger already exists`);
		return;
	}

	ScriptApp.newTrigger(RUN_SYNC_HANDLER).timeBased().everyHours(1).create();

	log(`Clock trigger created: GoIT Calendar Sync every 1 hour`);
}

function setupReminders() {
	const reminders = getOptionalJSONProperty<EventReminderOptions>(
		PROPERTY_KEYS.GCAL_REMINDERS,
	);
	if (!reminders) {
		log({
			message: "Reminders are not configured, using default options",
			reminders: DEFAULT_EVENT_REMINDER_OPTIONS,
		});
		setProperties({
			[PROPERTY_KEYS.GCAL_REMINDERS]: JSON.stringify(
				DEFAULT_EVENT_REMINDER_OPTIONS,
			),
		});
	} else {
		log({
			message: "Reminders are configured",
			reminders,
		});
	}
}

export function SETUP() {
	const banner = [
		" ▗▄▄▖ ▗▄▖ ▗▄▄▄▖▗▄▄▄▖     ▗▄▄▖ ▗▄▖ ▗▖   ▗▄▄▄▖▗▖  ▗▖▗▄▄▄  ▗▄▖ ▗▄▄▖      ▗▄▄▖▗▖  ▗▖▗▖  ▗▖ ▗▄▄▖",
		"▐▌   ▐▌ ▐▌  █    █      ▐▌   ▐▌ ▐▌▐▌   ▐▌   ▐▛▚▖▐▌▐▌  █▐▌ ▐▌▐▌ ▐▌    ▐▌    ▝▚▞▘ ▐▛▚▖▐▌▐▌   ",
		"▐▌▝▜▌▐▌ ▐▌  █    █      ▐▌   ▐▛▀▜▌▐▌   ▐▛▀▀▘▐▌ ▝▜▌▐▌  █▐▛▀▜▌▐▛▀▚▖     ▝▀▚▖  ▐▌  ▐▌ ▝▜▌▐▌   ",
		"▝▚▄▞▘▝▚▄▞▘▗▄█▄▖  █      ▝▚▄▄▖▐▌ ▐▌▐▙▄▄▖▐▙▄▄▖▐▌  ▐▌▐▙▄▄▀▐▌ ▐▌▐▌ ▐▌    ▗▄▄▞▘  ▐▌  ▐▌  ▐▌▝▚▄▄▖",
		"                                                                     by @gornostay25",
	].join("\n");
	console.log(banner);

	const accessToken = getOptionalProperty(PROPERTY_KEYS.GOIT_ACCESS_TOKEN);
	const refreshToken = getOptionalProperty(PROPERTY_KEYS.GOIT_REFRESH_TOKEN);
	if (!accessToken || !refreshToken) {
		console.warn("GoIT tokens are not configured.");
		console.info(
			[
				"Follow these steps to get the tokens:",
				"1. Open new ANONYMOUS tab in your browser",
				"2. Navigate to https://www.edu.goit.global/uk/calendar (Sign in)",
				"3. Open the developer tools console",
				"4. Run the following command:",
				`\tfetch("https://api.edu.goit.global/api/v1/auth/refresh",{"method":"POST","credentials":"include"}).then(r=>r.json()).then(console.log)`,
				"5. Copy the access token and refresh token",
				`6. Paste them into the script properties (${PROPERTY_KEYS.GOIT_ACCESS_TOKEN} and ${PROPERTY_KEYS.GOIT_REFRESH_TOKEN})`,
				"7. Save the script properties",
				"8. Run the setup again",
			].join("\n"),
		);
		return;
	}

	console.info(
		[
			"Event Reminders:",
			"================",
			"By default, popup reminders are set to 15 minutes before each event.",
			"You can customize reminders by setting the GCAL_REMINDERS property:",
			"",
			'Example: {"email": 0, "sms": 0, "popup": 15}',
			"  - email: minutes before event for email reminder (0 = disabled)",
			"  - sms: minutes before event for SMS reminder (0 = disabled)",
			"  - popup: minutes before event for popup notification (0 = disabled)",
			"",
			"Multiple values can be set simultaneously.",
			"All times are in minutes.",
			"Valid range: 1 to 40320 (4 weeks) minutes before event.",
		].join("\n"),
	);

	setupTrigger();
	setupReminders();
	log("Setup completed.");
	runSyncHandler();
}

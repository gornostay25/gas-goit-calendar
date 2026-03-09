import {
	getRequiredJSONProperty,
	getScriptProperties,
	PROPERTY_KEYS,
	type EventReminderOptions,
} from "./config/properties";
import type { NormalizedGoitEvent } from "./integrations/goit";
import { log, type GoitSyncWindow } from "./utils";

const GOIT_CALENDAR_NAME = "GoIT Calendar";
const CALENDAR_ID_PROPERTY = "GOIT_CALENDAR_ID";
const GOIT_EVENT_ID_TAG = "goitEventId";

type GoitReconcileSummary = {
	processed: number;
	scannedExisting: number;
	created: number;
	updated: number;
	skippedExisting: number;
	skippedInvalid: number;
};

export function ensureGoitCalendar(): GoogleAppsScript.Calendar.Calendar {
	const scriptProperties = getScriptProperties();
	const storedCalendarId = scriptProperties.getProperty(CALENDAR_ID_PROPERTY);
	if (storedCalendarId) {
		const storedCalendar = CalendarApp.getCalendarById(storedCalendarId);
		if (storedCalendar) {
			return storedCalendar;
		}
	}

	const existingByName = CalendarApp.getCalendarsByName(GOIT_CALENDAR_NAME);
	const reusable =
		existingByName.find((calendar) => calendar.isOwnedByMe()) ??
		existingByName[0];
	if (reusable) {
		scriptProperties.setProperty(CALENDAR_ID_PROPERTY, reusable.getId());
		return reusable;
	}

	const created = CalendarApp.createCalendar(GOIT_CALENDAR_NAME);
	// Set user timezone for the calendar
	created.setTimeZone(Session.getScriptTimeZone());
	created.setDescription("@gornostay25");
	created.setColor(CalendarApp.Color.ORANGE.toString());
	scriptProperties.setProperty(CALENDAR_ID_PROPERTY, created.getId());
	return created;
}

export function reconcileGoitEvents(
	calendar: GoogleAppsScript.Calendar.Calendar,
	goitEvents: NormalizedGoitEvent[],
	window: GoitSyncWindow,
): GoitReconcileSummary {
	const existingEvents = calendar.getEvents(window.start, window.end);
	const existingGoitEventIds = collectExistingGoitEventIds(existingEvents);
	const reminders = getRequiredJSONProperty<EventReminderOptions>(
		PROPERTY_KEYS.GCAL_REMINDERS,
	);

	let created = 0;
	let updated = 0;
	let skippedExisting = 0;
	let skippedInvalid = 0;

	for (const goitEvent of goitEvents) {
		const goitEventId = goitEvent.goitEventId.trim();
		if (!goitEventId) {
			skippedInvalid += 1;
			continue;
		}

		const existingGoogleEvent = existingGoitEventIds.get(goitEventId);
		if (existingGoogleEvent) {
			if (isEventChanged(existingGoogleEvent, goitEvent)) {
				updateCalendarEvent(existingGoogleEvent, goitEvent);
				updated += 1;
				log({
					message: "Updated event",
					goitEvent,
					existingGoogleEvent,
				});
			} else {
				skippedExisting += 1;
				log({
					message: "Skipping existing event",
					goitEvent,
				});
			}
			continue;
		}

		const createdEvent = createCalendarEvent(calendar, goitEvent);
		createdEvent.setTag(GOIT_EVENT_ID_TAG, goitEventId);

		/**
		 * The maximum number of minutes before an event that a reminder can be set is 40,320 (4 weeks).
		 * @see https://developers.google.com/apps-script/reference/calendar/calendar-event#addpopupreminderminutesbefore
		 */
		const maxReminderMinutes = 40320;
		if (
			reminders.popup &&
			reminders.popup > 0 &&
			reminders.popup < maxReminderMinutes
		) {
			createdEvent.addPopupReminder(reminders.popup);
		}
		if (
			reminders.email &&
			reminders.email > 0 &&
			reminders.email < maxReminderMinutes
		) {
			createdEvent.addEmailReminder(reminders.email);
		}
		if (
			reminders.sms &&
			reminders.sms > 0 &&
			reminders.sms < maxReminderMinutes
		) {
			createdEvent.addSmsReminder(reminders.sms);
		}
		created += 1;
	}

	return {
		processed: goitEvents.length,
		scannedExisting: existingEvents.length,
		created,
		updated,
		skippedExisting,
		skippedInvalid,
	};
}

function collectExistingGoitEventIds(
	existingEvents: GoogleAppsScript.Calendar.CalendarEvent[],
): Map<string, GoogleAppsScript.Calendar.CalendarEvent> {
	const eventMap = new Map<string, GoogleAppsScript.Calendar.CalendarEvent>();
	for (const event of existingEvents) {
		const goitEventId = event.getTag(GOIT_EVENT_ID_TAG)?.trim();
		if (goitEventId) {
			eventMap.set(goitEventId, event);
		}
	}

	return eventMap;
}

function isEventChanged(
	googleEvent: GoogleAppsScript.Calendar.CalendarEvent,
	goitEvent: NormalizedGoitEvent,
): boolean {
	const googleStartTime = googleEvent.getStartTime();
	const googleEndTime = googleEvent.getEndTime();
	const googleAllDay = googleEvent.isAllDayEvent();

	// Compare event details
	if (
		googleStartTime?.getTime() !== goitEvent.start.getTime() ||
		googleEndTime?.getTime() !== goitEvent.end.getTime() ||
		googleAllDay !== goitEvent.isAllDay
	) {
		return true;
	}

	return false;
}

function updateCalendarEvent(
	googleEvent: GoogleAppsScript.Calendar.CalendarEvent,
	goitEvent: NormalizedGoitEvent,
): void {
	log({
		message: "Updating event",
		goitEvent,
	});

	if (goitEvent.isAllDay) {
		googleEvent.setAllDayDate(goitEvent.start);
	} else {
		googleEvent.setTime(goitEvent.start, goitEvent.end);
	}
}

function createCalendarEvent(
	calendar: GoogleAppsScript.Calendar.Calendar,
	goitEvent: NormalizedGoitEvent,
): GoogleAppsScript.Calendar.CalendarEvent {
	log({
		message: "Creating event",
		goitEvent,
	});
	if (goitEvent.isAllDay) {
		return calendar.createAllDayEvent(goitEvent.title, goitEvent.start, {
			description: goitEvent.description,
		});
	}

	return calendar.createEvent(goitEvent.title, goitEvent.start, goitEvent.end, {
		description: goitEvent.description,
	});
}

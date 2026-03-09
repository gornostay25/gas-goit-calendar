# GoIT Calendar Integration (Google Apps Script)

Sync GoIT events into a dedicated Google Calendar (`GoIT Calendar`) using Google Apps Script (GAS).

## Overview

This project fetches events from the GoIT API and mirrors them into a separate Google Calendar.  
It is designed for reliable, repeatable synchronization with token refresh handling, duplicate protection, and automatic scheduled execution.

## Demo


https://github.com/user-attachments/assets/8953b316-4c5f-4ab1-a8d6-7b2b1c092805



## Features

- Creates or reuses a dedicated Google Calendar named `GoIT Calendar`
- Imports GoIT events into Google Calendar within a configurable time window
- Prevents duplicate events using stable GoIT event IDs stored as event tags
- Updates existing events when GoIT events change time or date
- Configurable event reminders (email, SMS, popup)
- Refreshes GoIT access tokens automatically on `401 Unauthorized`
- Set events based on user timezone
- Installs an hourly trigger via `SETUP()` for automated sync

## Tech Stack

- Runtime: Google Apps Script (V8)
- Language: TypeScript
- Build tool: Bun
- Deployment: `clasp`
- Lint/format: Biome

## Prerequisites

- [Bun](https://bun.sh/)
- Google account with access to Google Calendar
- `clasp` authentication

## Project Structure

- `src/main.ts` - script entrypoint and `SETUP()` function
- `src/sync.ts` - calendar creation and event reconciliation
- `src/integrations/goit/client.ts` - GoIT API client + token refresh flow
- `src/integrations/goit/mapper.ts` - GoIT payload normalization
- `src/config/properties.ts` - Script Properties helpers
- `scripts/build.ts` - build pipeline and GAS export adaptation
- `dist/` - build output pushed by `clasp`

## Getting Started

### 1) Install dependencies

```bash
bun install
```

### 2) Authorize `clasp`

```bash
bunx clasp login
```

### 3) Create Apps Script project (first time only)

```bash
bun run create
```

### 4) Build the project

```bash
bun run build
```

### 5) Deploy to Apps Script

```bash
bun run deploy
```

## Apps Script Configuration

After deployment, open your Apps Script project and set **Script Properties**:

| Key | Required | Default | Description |
| --- | --- | --- | --- |
| `GOIT_ACCESS_TOKEN` | Yes | - | GoIT API access token |
| `GOIT_REFRESH_TOKEN` | Yes | - | GoIT API refresh token |
| `GOIT_GROUP_IDS` | No | empty | Comma-separated GoIT group IDs |
| `SYNC_PAST_DAYS` | No | `7` | Number of days to sync in the past |
| `SYNC_FUTURE_DAYS` | No | `60` | Number of days to sync in the future |
| `GCAL_REMINDERS` | No | `{"email": 0, "sms": 0, "popup": 15}` | Event reminder configuration |

### Event Reminders

The `GCAL_REMINDERS` property allows you to configure event notifications:

```json
{
  "email": 30,
  "sms": 0,
  "popup": 15
}
```

- **email**: Minutes before event for email reminder (0 = disabled)
- **sms**: Minutes before event for SMS reminder (0 = disabled)
- **popup**: Minutes before event for popup notification (0 = disabled)

Multiple reminder types can be enabled simultaneously. All times are in minutes. Valid range: 5 to 40320 (4 weeks) minutes before the event.

### How to obtain GoIT tokens

Run `SETUP()` once in Apps Script.  
If tokens are missing, the script logs step-by-step instructions in execution logs, including a browser console command to retrieve fresh tokens.

## Runtime Flow

1. `SETUP()` checks token presence
2. Sets up default event reminders if not configured
3. Creates an hourly time-driven trigger (if not already present)
4. Starts an immediate sync run
5. Each run:
   - Acquires script lock to avoid concurrent sync
   - Ensures dedicated calendar exists
   - Fetches GoIT events for the configured window
   - Creates only missing events (deduplicated by GoIT event ID tag)
   - Updates existing events if time/date changed
   - Skips unchanged existing events
   - Applies configured reminders to new and updated events

## Development Workflow

```bash
# Build
bun run build

# Format
bun run format

# Lint
bun run lint
```


## License

MIT

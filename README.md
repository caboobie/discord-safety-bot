# Discord Safety Bot

A Discord moderation bot built with Node.js and discord.js — automated spam detection, link filtering with a trust system, a bad-word filter resistant to common evasion tricks, new-account flagging, and persistent moderation data via PostgreSQL.

![Discord safety bot screenshot](screenshot.png)

## Features

- **Spam/raid detection** — automatically times out users posting too many messages too quickly
- **Link filtering with trust** — new/inactive members can't post links until they've sent enough messages and been in the server long enough; trusted members pass through freely
- **Bad-word filtering** — blocks prohibited words even when disguised with punctuation (`p.o.r.n`), leetspeak (`sc4m`), or spacing (`s c a m`)
- **New-account gating** — flags accounts created very recently when they join, a common raid/bot pattern
- **Violation reporting** — every action is logged to a dedicated mod channel, pings a Moderator role, and DMs the server owner
- **Persistent trust data** — stored in PostgreSQL, so standing survives bot restarts and redeploys
- **Crash-resilient** — errors are caught and logged instead of taking the whole bot offline

## Tech

- Node.js
- discord.js
- PostgreSQL (via the `pg` library)
- Hosted on Railway

## Setup

### 1. Create a Discord bot application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications), create a new application
2. Under **Bot**, add a bot user and copy its token
3. Enable **Message Content Intent** and **Server Members Intent** under Privileged Gateway Intents
4. Under **OAuth2 → URL Generator**, select the `bot` scope and these permissions: View Channels, Send Messages, Manage Messages, Timeout Members, Kick Members
5. Use the generated URL to invite the bot to your server

### 2. Set up the project

git clone https://github.com/caboobie/discord-safety-bot.git
cd discord-safety-bot
npm install


### 3. Configure environment variables

Create a `.env` file with:

DISCORD_TOKEN=your_bot_token
MOD_LOG_CHANNEL_ID=your_mod_log_channel_id
MODERATOR_ROLE_ID=your_moderator_role_id
DATABASE_URL=your_postgresql_connection_string


(`MOD_LOG_CHANNEL_ID` and `MODERATOR_ROLE_ID` are found via Discord's Developer Mode — right-click the channel/role → Copy ID.)

### 4. Run it

node index.js


## Deployment

This bot is designed as **one instance per Discord server** — each server you want protected gets its own deployment (e.g. on [Railway](https://railway.app)) with its own set of environment variables above, plus its own PostgreSQL database. It isn't currently built to serve multiple servers from a single running instance.

## Configuration

Some thresholds are set as constants near the top of `index.js` and can be adjusted directly:

- `TRUST_MESSAGES_THRESHOLD` — messages required before a user is trusted to post links (default: 15)
- `TRUST_DAYS_THRESHOLD` — days in the server required for the same (default: 1)
- `ACCOUNT_AGE_THRESHOLD` — account age (in days) under which new joiners get flagged (default: 3)

The blocked word list lives in `badwords.js` and can be edited directly.

## What I learned

- Working with a different runtime (Node.js) and library (discord.js) outside the browser
- Async/await for operations that talk to an external API
- Regular expressions, including handling real-world text evasion tricks
- SQL and parameterized queries, and why they matter for security (SQL injection)
- The difference between internal and public database connection strings when developing locally against a cloud-hosted database
- Deploying and hosting a live, always-on Node.js application
- Debugging real production issues: permission errors, role hierarchy, environment variable mismatches, and duplicate-instance bugs
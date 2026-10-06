# Discord Safety Bot

A Discord moderation bot — automated spam detection, link filtering with a trust system, a bad-word filter resistant to common evasion tricks, new-account flagging, and per-server moderation logging. Runs as a single bot serving multiple Discord servers at once.

![Discord safety bot screenshot](screenshot.png)

## Add it to your server

[**Invite Last Line Defence to your Discord server →**](your-invite-link-here)

Once invited, a server admin (someone with Manage Server permission) runs one command in any channel:

!setup #mod-log-channel @ModeratorRole


That's it — no further setup needed.

## Features

- **Spam/raid detection** — automatically times out users posting too many messages too quickly, tracked separately per server
- **Link filtering with trust** — new/inactive members can't post links until they've sent enough messages and been in the server long enough; trusted members pass through freely
- **Bad-word filtering** — blocks prohibited words even when disguised with punctuation (`p.o.r.n`), leetspeak (`sc4m`), or spacing (`s c a m`)
- **New-account gating** — flags accounts created very recently when they join, a common raid/bot pattern
- **Violation reporting** — every action is logged to your server's configured mod channel, pings your Moderator role, and DMs the server owner
- **Per-server configuration** — your settings are independent from every other server using the bot
- **Persistent trust data** — stored in a database, so standing survives bot restarts

## Tech

- Node.js, discord.js
- PostgreSQL
- Hosted on Railway

## Self-hosting

Prefer to run your own instance instead of using the hosted bot above? You can.

### 1. Create a Discord bot application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications), create a new application
2. Under **Bot**, add a bot user and copy its token
3. Enable **Message Content Intent** and **Server Members Intent** under Privileged Gateway Intents
4. Under **OAuth2 → URL Generator**, select the `bot` scope and these permissions: View Channels, Send Messages, Manage Messages, Timeout Members, Kick Members

### 2. Set up the project

git clone https://github.com/caboobie/discord-safety-bot.git
cd discord-safety-bot
npm install


### 3. Configure environment variables

DISCORD_TOKEN=your_bot_token
DATABASE_URL=your_postgresql_connection_string


### 4. Run it

node index.js


Once running, invite your bot and run `!setup` in any server exactly as described above — it works the same way regardless of who's hosting it.

## Configuration

Some thresholds are set as constants near the top of `index.js` and apply globally across all servers using this instance:

- `TRUST_MESSAGES_THRESHOLD` — messages required before a user is trusted to post links (default: 15)
- `TRUST_DAYS_THRESHOLD` — days in the server required for the same (default: 1)
- `ACCOUNT_AGE_THRESHOLD` — account age (in days) under which new joiners get flagged (default: 3)

The blocked word list lives in `badwords.js`.

## What I learned

- Working with a different runtime (Node.js) and library (discord.js) outside the browser
- Async/await for operations that talk to an external API
- Regular expressions, including handling real-world text evasion tricks
- SQL, parameterized queries (and why they matter for security), and composite primary keys
- Designing a database schema around multi-tenant data
- Deploying and hosting a live, always-on Node.js application
- Debugging real production issues: permission errors, role hierarchy, environment variable mismatches, duplicate-instance bugs
- Reworking an architecture after an initial design decision turned out not to scale, rather than forcing the original plan to work
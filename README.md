# Last Line Defence

**Launch your Discord server with confidence—and keep it safer from day one.** Last Line Defence brings essential moderation protections together with a straightforward setup, so you can spend less time configuring tools and more time building your community.

## Getting Started

1. [Invite Last Line Defence to your server](YOUR_INVITE_URL_HERE) — replace this placeholder with the bot's invite URL.
2. In your server, have an administrator with **Manage Server** permission configure the moderation log:

   `!setup #mod-log-channel @ModeratorRole`

3. To trust a member so they can post links without meeting the automatic trust thresholds, use:

   `!trust @user`

## Protect your community

- **Spam protection:** times out members who send four or more messages within five seconds.
- **Link filtering:** members need to meet the trust thresholds or be trusted by an administrator before posting links.
- **Prohibited-word filtering:** catches blocked terms, including common punctuation, spacing, and character substitutions.
- **New-account alerts:** flags members whose Discord account is less than three days old when they join.
- **Moderation visibility:** sends violation reports to your configured mod-log channel and mentions your Moderator role.
- **Server-specific settings:** each server has its own moderation channel, moderator role, and trust records.

## Self-hosting

Run your own instance with Node.js and PostgreSQL. The bot creates and updates its required database tables when it connects.

1. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Enable **Message Content Intent** and **Server Members Intent** in the bot's privileged gateway intents.
3. Invite your bot with permissions to view channels, send messages, manage messages, and moderate members. Ensure it can mention the configured moderator role.
4. Clone and install the project:

   ```sh
   git clone https://github.com/caboobie/discord-safety-bot.git
   cd discord-safety-bot
   npm install
   ```

5. Copy `.env.example` to `.env`, then set your bot token and PostgreSQL connection string:

   ```sh
   cp .env.example .env
   ```

6. Start the bot:

   ```sh
   node index.js
   ```

   The required values are `DISCORD_TOKEN` and `DATABASE_URL`. The PostgreSQL database must be reachable by the bot.

Once the bot is online, run the setup command in each server where you want moderation logging and protections enabled.

## Built with

- Node.js and discord.js
- PostgreSQL


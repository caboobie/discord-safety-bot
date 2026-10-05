require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

const messageTimestamps = new Map();
//const messageCounts = new Map();
const TRUST_MESSAGES_THRESHOLD = 15;
const TRUST_DAYS_THRESHOLD = 1;
const linkPattern = /https?:\/\/[^\s]+/i;
const ACCOUNT_AGE_THRESHOLD = 3; // in days

const badWords = require('./badwords.js');
const badWordsPattern = new RegExp(`\\b(${badWords.join('|')})\\b`, 'i');
const badWordsPatternLoose = new RegExp(badWords.join('|'), 'i');

async function initDatabase() {
  await pool.query(`DROP TABLE IF EXISTS user_trust;`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id TEXT PRIMARY KEY,
            mod_log_channel_id TEXT,
            moderator_role_id TEXT
        );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_trust (
        guild_id TEXT NOT NULL,
        discord_id TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, discord_id)
      );
    `);
    console.log('Database ready.');
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9\s]/g, '');
}

async function reportViolation(message, reason) {
  //console.log('reportViolation called. MOD_LOG_CHANNEL_ID:', process.env.MOD_LOG_CHANNEL_ID);

  const logChannel = message.guild.channels.cache.get(process.env.MOD_LOG_CHANNEL_ID);
  //console.log('logChannel found:', logChannel ? logChannel.name : 'NOT FOUND');

  const report = `🚨 **Violation Detected**\n` +
    `**User:** ${message.author.tag} (${message.author.id})\n` +
    `**Reason:** ${reason}\n` +
    `**Message:** ${message.content}\n` +
    `<@&${process.env.MODERATOR_ROLE_ID}>`;

  if (logChannel) {
    await logChannel.send(report);
    //console.log('Report sent to log channel.');
  }

  const owner = await message.guild.fetchOwner();
  await owner.send(report);
  //console.log('Report DMed to owner.');
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await initDatabase();
});

client.on('guildMemberAdd', async (member) => {
  try {
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

    if (accountAgeDays < ACCOUNT_AGE_THRESHOLD) {
      const logChannel = member.guild.channels.cache.get(process.env.MOD_LOG_CHANNEL_ID);
      const warning = `⚠️ **New Member with Young Account**\n` +
        `**User:** ${member.user.tag} (${member.user.id})\n` +
        `**Account Age:** ${accountAgeDays.toFixed(1)} days\n` +
        `<@&${process.env.MODERATOR_ROLE_ID}>`;

      if (logChannel) {
        await logChannel.send(warning);
      }
    }
  } catch (error) {
    console.error('Error handling new guild member:', error);
  }
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    const userId = message.author.id;
    const now = Date.now();

    if (!messageTimestamps.has(userId)) {
      messageTimestamps.set(userId, []);
    }
    const timestamps = messageTimestamps.get(userId);
    timestamps.push(now);
    const recentTimestamps = timestamps.filter(t => now - t <= 5000);
    messageTimestamps.set(userId, recentTimestamps);

    console.log(`${message.author.tag}: ${recentTimestamps.length} messages in the last 5 seconds`);

    if (recentTimestamps.length >= 4) {
      await message.member.timeout(60000, 'Spam detected: too many messages too quickly');
      await message.channel.send(`${message.author} has been timed out for spamming.`);
      messageTimestamps.set(userId, []);
      return;
    }

    const normalized = normalizeText(message.content);
    const despaced = normalized.replace(/\s+/g, '');

    if (badWordsPattern.test(normalized) || badWordsPatternLoose.test(despaced)) {
      await message.delete();
      await message.channel.send(`${message.author} posted a message containing prohibited words.`);
      await reportViolation(message, 'Posted a message containing prohibited words.');
      return;
    }

    const result = await pool.query(
        'INSERT INTO user_trust (discord_id, message_count) VALUES ($1, 1) ON CONFLICT (discord_id) DO UPDATE SET message_count = user_trust.message_count + 1 RETURNING message_count',
        [userId]
    );
    const currentCount = result.rows[0].message_count;
    //console.log(`${message.author.tag} now has ${currentCount} messages in the database.`);

    if (linkPattern.test(message.content)) {
      const joinedAt = message.member.joinedTimestamp;
      const daysInServer = (Date.now() - joinedAt) / (1000 * 60 * 60 * 24);
      const isTrusted = currentCount >= TRUST_MESSAGES_THRESHOLD && daysInServer >= TRUST_DAYS_THRESHOLD;

      if (!isTrusted) {
        await message.delete();
        await message.channel.send(`${message.author} posted a link but is not trusted yet.`);
        await reportViolation(message, 'Posted a link but is not trusted yet.');
        return;
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

client.login(process.env.DISCORD_TOKEN);
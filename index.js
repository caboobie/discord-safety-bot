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
      manually_trusted BOOLEAN DEFAULT FALSE,
      PRIMARY KEY (guild_id, discord_id)
    );
  `);

  await pool.query(`
    ALTER TABLE user_trust
    ADD COLUMN IF NOT EXISTS manually_trusted BOOLEAN DEFAULT FALSE;
  `);

  await pool.query(`
    ALTER TABLE guild_settings
    ADD COLUMN IF NOT EXISTS moderation_mode TEXT DEFAULT 'enforce';
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

async function getModerationMode(guildId) {
  const res = await pool.query(
    'SELECT moderation_mode FROM guild_settings WHERE guild_id = $1',
    [guildId]
  );
  return res.rows[0]?.moderation_mode === 'warn' ? 'warn' : 'enforce';
}

function findBadWordMatch(normalized, despaced) {
  let m = normalized.match(badWordsPattern);
  if (m) {
    const text = normalized.slice(0, m.index) + '**[[' + m[0] + ']]**' + normalized.slice(m.index + m[0].length);
    return { word: m[0], context: text };
  }
  m = despaced.match(badWordsPatternLoose);
  if (m) {
    const text = despaced.slice(0, m.index) + '**[[' + m[0] + ']]**' + despaced.slice(m.index + m[0].length);
    return { word: m[0], context: text, despaced: true };
  }
  return null;
}

async function reportViolation(message, reason, mode = 'enforce', detail = '') {
  //console.log('reportViolation called. MOD_LOG_CHANNEL_ID:', process.env.MOD_LOG_CHANNEL_ID);

  const settingResult = await pool.query(
    'SELECT mod_log_channel_id, moderator_role_id FROM guild_settings WHERE guild_id = $1',
    [message.guild.id]
  );

  if (settingResult.rows.length === 0) return;

  const { mod_log_channel_id, moderator_role_id } = settingResult.rows[0];
  const logChannel = message.guild.channels.cache.get(mod_log_channel_id);
  //console.log('logChannel found:', logChannel ? logChannel.name : 'NOT FOUND');

  const report = `🚨 **Violation Detected**\n` +
    `**User:** ${message.author.tag} (${message.author.id})\n` +
    `**Reason:** ${reason}\n` +
    `**Mode:** ${mode}${mode === 'warn' ? ' (no action taken)' : ''}\n` +
    `**Message:** ${message.content}\n` +
    (detail ? `${detail}\n` : '') +
    `<@&${moderator_role_id}>`;

  if (logChannel) {
    await logChannel.send(report);
    //console.log('Report sent to log channel.');
  }

  //const owner = await message.guild.fetchOwner();
  //await owner.send(report);
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
      const settingResult = await pool.query(
        'SELECT mod_log_channel_id, moderator_role_id FROM guild_settings WHERE guild_id = $1',
        [member.guild.id]
      );

      if (settingResult.rows.length === 0) return;

      const { mod_log_channel_id, moderator_role_id } = settingResult.rows[0];
      
      const logChannel = member.guild.channels.cache.get(mod_log_channel_id);
      
      const warning = `⚠️ **New Member with Young Account**\n` +
        `**User:** ${member.user.tag} (${member.user.id})\n` +
        `**Account Age:** ${accountAgeDays.toFixed(1)} days\n` +
        `<@&${moderator_role_id}>`;

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
    
    if (message.content.startsWith('!setup') && message.member.permissions.has('ManageGuild')) {
      const channelMention = message.mentions.channels.first();
      const roleMention = message.mentions.roles.first();

      if (!channelMention || !roleMention) {
        await message.channel.send('usage: `!setup #mod-log-channel @moderatorRole`');
        return;
      }

      await pool.query(
        'INSERT INTO guild_settings (guild_id, mod_log_channel_id, moderator_role_id) ' +
        'VALUES ($1, $2, $3) ' +
        'ON CONFLICT (guild_id) DO UPDATE SET ' +
        'mod_log_channel_id = $2, moderator_role_id = $3',
        [message.guild.id, channelMention.id, roleMention.id]
      );

      await message.channel.send(`Setup complete. Mod log: ${channelMention}, Moderator role: ${roleMention}`);
      return;
    }

    if (message.content.startsWith('!trust') && message.member.permissions.has('ManageGuild')) {
      const mentionedUser = message.mentions.users.first();

      if (!mentionedUser) {
        await message.channel.send('usage: `!trust @user`');
        return;
      }

      await pool.query(
        `INSERT INTO user_trust (guild_id, discord_id, manually_trusted)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (guild_id, discord_id) DO UPDATE
         SET manually_trusted = TRUE`,
        [message.guild.id, mentionedUser.id]
      );

      await message.channel.send(`${mentionedUser} has been manually trusted.`);
      return;
    }

    if (message.content.startsWith('!untrust') && message.member.permissions.has('ManageGuild')) {
      const mentionedUser = message.mentions.users.first();

      if (!mentionedUser) {
        await message.channel.send('usage: `!untrust @user`');
        return;
      }

      const untrustResult = await pool.query(
        `UPDATE user_trust SET manually_trusted = FALSE
         WHERE guild_id = $1 AND discord_id = $2`,
        [message.guild.id, mentionedUser.id]
      );

      if (untrustResult.rowCount === 0) {
        await message.channel.send(`${mentionedUser} has no trust record in this server; nothing to change.`);
        return;
      }

      await message.channel.send(`${mentionedUser} is no longer manually trusted.`);
      return;
    }

    if (message.content.startsWith('!mode') && message.member.permissions.has('ManageGuild')) {
      const requested = (message.content.split(/\s+/)[1] || '').toLowerCase();

      if (requested !== 'warn' && requested !== 'enforce') {
        const current = await getModerationMode(message.guild.id);
        await message.channel.send(`usage: \`!mode warn|enforce\` (current mode: ${current})`);
        return;
      }

      const modeResult = await pool.query(
        'UPDATE guild_settings SET moderation_mode = $2 WHERE guild_id = $1',
        [message.guild.id, requested]
      );

      if (modeResult.rowCount === 0) {
        await message.channel.send('Run `!setup #mod-log-channel @moderatorRole` first.');
        return;
      }

      await message.channel.send(`Moderation mode set to **${requested}**.`);
      return;
    }

    const userId = message.author.id;
    const now = Date.now();
    const timestampKey = `${message.guild.id}-${userId}`;

    if (!messageTimestamps.has(timestampKey)) {
      messageTimestamps.set(timestampKey, []);
    }

    const timestamps = messageTimestamps.get(timestampKey);
    timestamps.push(now);
    const recentTimestamps = timestamps.filter(t => now - t <= 5000);
    messageTimestamps.set(timestampKey, recentTimestamps);

    console.log(`${message.author.tag}: ${recentTimestamps.length} messages in the last 5 seconds`);

    const mode = await getModerationMode(message.guild.id);
    const enforcing = mode === 'enforce';

    if (recentTimestamps.length >= 4) {
      messageTimestamps.set(timestampKey, []);
      if (enforcing) {
        await message.member.timeout(60000, 'Spam detected: too many messages too quickly');
        await message.channel.send(`${message.author} has been timed out for spamming.`);
      } else {
        await reportViolation(message, 'Spam detected: too many messages too quickly.', mode);
      }
      return;
    }

    const normalized = normalizeText(message.content);
    const despaced = normalized.replace(/\s+/g, '');

    const badMatch = findBadWordMatch(normalized, despaced);
    if (badMatch) {
      if (enforcing) {
        await message.delete();
        await message.channel.send(`${message.author} posted a message containing prohibited words.`);
      }
      await reportViolation(message, 'Posted a message containing prohibited words.', mode,
        `**Matched:** \`${badMatch.word}\`${badMatch.despaced ? ' (found after removing spaces)' : ''}\n` +
        `**Normalized text:** ${badMatch.context}`.slice(0, 900));
      return;
    }

    const result = await pool.query(
        `INSERT INTO user_trust (guild_id, discord_id, message_count)
        VALUES ($1, $2, 1)
        ON CONFLICT (guild_id, discord_id) DO UPDATE
        SET message_count = user_trust.message_count + 1
        RETURNING message_count, manually_trusted`,
        [message.guild.id, userId]
    );
    const currentCount = result.rows[0].message_count;
    const isManuallyTrusted = result.rows[0].manually_trusted;
    //console.log(`${message.author.tag} now has ${currentCount} messages in the database.`);

    if (linkPattern.test(message.content)) {
      const joinedAt = message.member.joinedTimestamp;
      const daysInServer = (Date.now() - joinedAt) / (1000 * 60 * 60 * 24);
      const isTrusted = isManuallyTrusted || (currentCount >= TRUST_MESSAGES_THRESHOLD && daysInServer >= TRUST_DAYS_THRESHOLD);

      if (!isTrusted) {
        if (enforcing) {
          await message.delete();
          await message.channel.send(`${message.author} posted a link but is not trusted yet.`);
        }
        await reportViolation(message, 'Posted a link but is not trusted yet.', mode);
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
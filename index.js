require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client =  new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

async function reportViolation(message, reason) {
    const logChannel = message.guild.channels.cache.get(process.env.MOD_LOG_CHANNEL_ID);

    const report = ` 🚨 **Violation Detected**\n` +
                   `**User:** ${message.author.tag} (${message.author.id})\n` +
                   `**Reason:** ${reason}\n` +
                   `**Message:** ${message.content}` +
                   `<&${process.env.MODERATOR_ROLE_ID}>`;
    
    if (logChannel) {
        await logChannel.send(report);
    }

    const owner = await message.guild.fetchOwner();
    await owner.send(report);
}

const messageTimestamps = new Map();

const messageCounts = new Map();
const TRUST_MESSAGES_THRESHOLD = 15;
const TRUST_DAYS_THRESHOLD = 3;
const linkPattern = /https?:\/\/[^\s]+/i;
const badWords = require('./badwords.js');
const badWordsPattern = new RegExp(badWords.join('|'), 'i');



client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (badWordsPattern.test(message.content)) {
        await message.delete();
        await message.channel.send(`${message.author} posted a message containing prohibited words.`);
        await reportViolation(message, 'Posted a message containing prohibited words.');
        return;
    }


    const userId = message.author.id;

    const currentCount = messageCounts.get(userId) || 0;
    messageCounts.set(userId, currentCount + 1);

    if (linkPattern.test(message.content)) {
        const joinedAt = message.member.joinedTimestamp;
        const daysInServer = (Date.now() - joinedAt) / (1000 * 60 * 60 * 24);
        
        const isTrusted = currentCount >= TRUST_MESSAGES_THRESHOLD && daysInServer >= TRUST_DAYS_THRESHOLD;

        if (!isTrusted) {
            await message.delete();
            await message.channel.send(`${message.author} posted a link but is not trusted yet.`
            );
            await reportViolation(message, 'Posted a link but is not trusted yet.');
            return;
        }
        
    }
    const now = Date.now();

    if (!messageTimestamps.has(userId)) {
        messageTimestamps.set(userId, []);
    }
    
    const timestamps = messageTimestamps.get(userId);
    timestamps.push(now);

    const recentTimestamps = timestamps.filter(t => now - t <= 5000); // last 5 seconds
    messageTimestamps.set(userId, recentTimestamps);

    console.log(`${message.author.tag}: ${recentTimestamps.length} messages in the last 5 seconds`);

    if (recentTimestamps.length > 5) { // more than 5 messages in the last 5 seconds
        await message.member.timeout(60000, 'Spam detected: too many messages too quickly');
        await message.channel.send(`${message.author} has been timed out for spamming.`);
        messageTimestamps.set(userId, []); // reset the user's message timestamps after timeout
    }
});


client.login(process.env.DISCORD_TOKEN);
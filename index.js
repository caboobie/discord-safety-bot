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

const messageTimestamps = new Map();


client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;
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
require("dotenv").config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const loggedMessageIds = new Set();
const recentPingByUserChannel = new Map();
const DEBOUNCE_MS = 1200;

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (loggedMessageIds.has(message.id)) return;

  const roles = [...message.mentions.roles.values()].map(r => r.name);
  const users = [...message.mentions.users.values()].map(u => u.tag);
  if (!message.mentions.everyone && roles.length === 0 && users.length === 0) return;

  const key = `${message.author.id}:${message.channel.id}:${message.content}`;
  const now = Date.now();
  const last = recentPingByUserChannel.get(key) || 0;
  if (now - last < DEBOUNCE_MS) return;
  recentPingByUserChannel.set(key, now);

  loggedMessageIds.add(message.id);

  const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
  const timestamp = Math.floor(message.createdTimestamp / 1000);
  const formattedTime = `<t:${timestamp}:F> (<t:${timestamp}:R>)`;

  const roleLinks = roles.map(name => `[${escapeForLink(`@${name}`)}](${messageLink})`);
  const userLinks = users.map(tag => `[${escapeForLink(tag)}](${messageLink})`);

  const mentionsDisplay = [
    ...(message.mentions.everyone ? ['@everyone/@here'] : []),
    ...roleLinks,
    ...userLinks
  ].join(', ');

  // Build each line, then wrap with bold markers so everything appears bold
  const lineRole = `Role: ${mentionsDisplay}`;
  const lineFrom = `From: [${escapeForLink(message.author.tag)}](${messageLink})`;
  const lineWhere = `Where: ${message.channel}`;
  const lineTime = `Time: ${formattedTime}`;

  const logMsg =
    `**New Ping detected!**\n` +
    `**${lineRole}**\n` +
    `**${lineFrom}**\n` +
    `**${lineWhere}**\n` +
    `**${lineTime}**`;

  const jumpButton = new ButtonBuilder()
    .setLabel("Jump to message")
    .setStyle(ButtonStyle.Link)
    .setURL(messageLink);

  const row = new ActionRowBuilder().addComponents(jumpButton);

  let logChannel = message.guild.channels.cache.find(c => c.name === "ping-logs");
  if (!logChannel) {
    logChannel = await message.guild.channels.create({ name: "ping-logs", type: 0 });
  }

  await logChannel.send({
    content: logMsg,
    components: [row],
    allowedMentions: { parse: [], users: [], roles: [] }
  });

  setTimeout(() => {
    loggedMessageIds.delete(message.id);
    if (recentPingByUserChannel.get(key) === now) recentPingByUserChannel.delete(key);
  }, DEBOUNCE_MS * 2);
});

// Escape characters that would break the markdown link text but do not escape asterisks
function escapeForLink(text) {
  return text.replace(/([\|`\\])/g, '\\$1');
}

console.log("Token loaded?", process.env.DISCORD_TOKEN ? "Yes" : "No");
client.login(process.env.DISCORD_TOKEN);
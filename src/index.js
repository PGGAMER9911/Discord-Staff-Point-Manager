import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import { checkDatabaseConnection } from './services/database.js';
import { isAllowedServer } from '../config.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Command collection
client.commands = new Collection();

/**
 * Load all commands from the commands directory
 */
async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(`file://${filePath}`);
    
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
      console.warn(`⚠️ Command at ${file} is missing required "data" or "execute" property.`);
    }
  }
}

/**
 * Register slash commands with Discord
 */
async function registerCommands() {
  const commands = [];
  
  for (const command of client.commands.values()) {
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`🔄 Refreshing ${commands.length} application (/) commands...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log(`✅ Successfully registered ${data.length} application commands.`);
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

/**
 * Handle interaction events
 */
client.on('interactionCreate', async interaction => {
  // Handle button interactions separately (for help pagination, etc.)
  if (interaction.isButton()) {
    // Button interactions are already handled by collectors in respective commands
    // Just ensure server validation
    if (!isAllowedServer(interaction.guild?.id)) {
      return await interaction.reply({
        content: '🔒 **Access Denied** - This bot only works in authorized servers.',
        ephemeral: true
      });
    }
    return; // Let the command's collector handle it
  }

  if (!interaction.isChatInputCommand()) return;

  // SECURITY: Check if command is from allowed server
  if (!isAllowedServer(interaction.guild?.id)) {
    return await interaction.reply({
      content: [
        '🔒 **Access Denied**',
        '',
        'This bot is configured to work in a specific server only.',
        'Contact the bot administrator for access.',
        '',
        '────────────────────────────'
      ].join('\n'),
      ephemeral: true
    });
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  // Log command usage to terminal
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const username = interaction.user.username;
  const userId = interaction.user.id;
  const commandName = interaction.commandName;
  const subcommand = interaction.options.getSubcommand(false);
  const guildName = interaction.guild?.name || 'DM';
  
  console.log('\n' + '='.repeat(60));
  console.log(`📢 COMMAND EXECUTED`);
  console.log(`Time: ${timestamp}`);
  console.log(`Server: ${guildName}`);
  console.log(`User: ${username} (ID: ${userId})`);
  console.log(`Command: /${commandName}${subcommand ? ' ' + subcommand : ''}`);
  console.log('='.repeat(60) + '\n');

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);
    
    // Only respond if command hasn't handled the error itself
    try {
      const errorMessage = '❌ There was an error executing this command.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
      }
    } catch (err) {
      // Silently ignore if interaction expired or already handled
      console.error('Could not send error message:', err.message);
    }
  }
});

/**
 * Secret ping command - Hidden prefix
 * Trigger: >>ping
 */
client.on('messageCreate', async message => {
  // Ignore bot messages
  if (message.author.bot) return;

  // SECURITY: Check if message is from allowed server
  if (!isAllowedServer(message.guild?.id)) return;

  // Secret prefix: >>
  const secretPrefix = '>>';
  
  if (!message.content.startsWith(secretPrefix)) return;

  const args = message.content.slice(secretPrefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Ping command
  if (command === 'ping') {
    const timestamp = Date.now();
    
    try {
      const reply = await message.reply('🏓 Pinging...');
      const latency = Date.now() - timestamp;
      const apiLatency = Math.round(client.ws.ping);

      await reply.edit({
        content: [
          '🏓 **PONG!**',
          '',
          `📡 **Bot Latency:** ${latency}ms`,
          `💫 **API Latency:** ${apiLatency}ms`,
          `⚡ **Status:** ${apiLatency < 200 ? 'Excellent' : apiLatency < 400 ? 'Good' : 'Slow'}`,
          '',
          '────────────────────────────',
        ].join('\n')
      });

      console.log(`\n🏓 PING Command executed by ${message.author.username} - Latency: ${latency}ms\n`);
    } catch (error) {
      console.error('Ping command error:', error);
    }
  }
});

/**
 * Bot ready event (using clientReady for Discord.js v15 compatibility)
 */
client.once('clientReady', async () => {
  console.log('='.repeat(50));
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`🆔 Client ID: ${client.user.id}`);
  console.log(`🌐 Connected to ${client.guilds.cache.size} guild(s)`);
  console.log('='.repeat(50));

  // Check database connection
  const dbConnected = await checkDatabaseConnection();
  if (dbConnected) {
    console.log('✅ Database connection successful');
  } else {
    console.error('❌ Database connection failed');
  }

  // Register commands
  await registerCommands();
  
  console.log('='.repeat(50));
  console.log('🚀 Bot is ready!');
  console.log('='.repeat(50));

  // Send startup message to status channel
  const statusChannelId = process.env.STATUS_CHANNEL_ID;
  if (statusChannelId) {
    try {
      const channel = await client.channels.fetch(statusChannelId);
      if (channel && channel.isTextBased()) {
        const timestamp = Math.floor(Date.now() / 1000);
        await channel.send({
          content: [
            `✅ **BOT ONLINE**`,
            ``,
            `🔹 **Status:** Ready`,
            `🔹 **Time:** <t:${timestamp}:F>`,
            `🔹 **Version:** 1.1.0`,
            ``,
            `────────────────────────────`,
          ].join('\n')
        });
      }
    } catch (error) {
      console.error('Failed to send startup message:', error);
    }
  }
});

/**
 * Error handling
 */
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

/**
 * Shutdown handler - Send offline message
 */
async function shutdown() {
  console.log('\n' + '='.repeat(50));
  console.log('🛑 Shutting down bot...');
  
  const statusChannelId = process.env.STATUS_CHANNEL_ID;
  if (statusChannelId && client.isReady()) {
    try {
      const channel = await client.channels.fetch(statusChannelId);
      if (channel && channel.isTextBased()) {
        const timestamp = Math.floor(Date.now() / 1000);
        await channel.send({
          content: [
            `🔴 **BOT OFFLINE**`,
            ``,
            `🔹 **Status:** Shutting down`,
            `🔹 **Time:** <t:${timestamp}:F>`,
            ``,
            `────────────────────────────`,
          ].join('\n')
        });
      }
    } catch (error) {
      console.error('Failed to send shutdown message:', error);
    }
  }
  
  console.log('✅ Bot shutdown complete');
  console.log('='.repeat(50));
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * Start the bot
 */
async function start() {
  try {
    // Load commands
    await loadCommands();

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

start();

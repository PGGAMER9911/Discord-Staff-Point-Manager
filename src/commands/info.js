import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('info')
  .setDescription('View bot information and statistics');

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const client = interaction.client;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    // Build premium info embed with improved styling
    const infoEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🤖 Staff Points Management System')
      .setDescription('> *Professional staff tracking with premium profiles and analytics*\n\n**Quick Access:** Use `/help` for commands')
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }));

    // Bot Purpose
    infoEmbed.addFields({
      name: '\n🎯 Purpose',
      value: '```Production-grade Discord bot for streamlined staff management```\n**Features:** Transparent points system • Detailed profiles • Complete audit trails',
      inline: false
    });

    // Core Systems
    infoEmbed.addFields({
      name: '\n⚙️ Core Systems',
      value: [
        '`💰` **Points Management** → Add, remove, and track staff points',
        '`👤` **Premium Profiles** → Age-verified profiles with custom tags',
        '`📜` **Transaction History** → Complete audit logs with DM export',
        '`📰` **Update System** → Track bot improvements and changes'
      ].join('\n'),
      inline: false
    });

    // Statistics
    infoEmbed.addFields({
      name: '\n📊 Bot Statistics',
      value: [
        `\`\`\``,
        `Servers    : ${client.guilds.cache.size}`,
        `Users      : ${client.users.cache.size}`,
        `Channels   : ${client.channels.cache.size}`,
        `Uptime     : ${hours}h ${minutes}m ${seconds}s`,
        `\`\`\``
      ].join('\n'),
      inline: true
    });

    // Technical Info
    infoEmbed.addFields({
      name: '\n🔧 Technical Stack',
      value: [
        `\`\`\``,
        `Discord.js : v14`,
        `Node.js    : ${process.version}`,
        `Database   : Supabase`,
        `Memory     : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        `\`\`\``
      ].join('\n'),
      inline: true
    });

    // Security & Privacy
    infoEmbed.addFields({
      name: '\n🔒 Security & Privacy',
      value: [
        '`🛡️` **Server Lock** → Single authorized server only',
        '`🔐` **RLS Policies** → Database-level security layer',
        '`⚛️` **Atomic Transactions** → Data integrity guaranteed',
        '`🔒` **Profile Privacy** → Points visible to owner only',
        '`📝` **Audit Logging** → All actions tracked & logged'
      ].join('\n'),
      inline: false
    });

    // Developer Info
    infoEmbed.addFields({
      name: '\n👨‍💻 Developer Information',
      value: [
        '**Created by:** `PGGAMER9911`',
        '**Version:** `v2.0.0` (Premium Edition)',
        '**Repository:** [View on GitHub](https://github.com/PGGAMER9911/Discord-Staff-Point-Manager)',
        '**Support:** Use `/help` for assistance'
      ].join('\n'),
      inline: false
    });

    // Footer
    infoEmbed.setFooter({ 
      text: 'Professional • Secure • Trusted' 
    })
    .setTimestamp();

    await interaction.editReply({ embeds: [infoEmbed] });
  } catch (error) {
    console.error('Error executing info command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Error')
      .setDescription(error.message || 'Failed to fetch bot information.')
      .setTimestamp();
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

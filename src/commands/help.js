import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('View all bot commands with examples');

// Command categories with detailed examples
const commandCategories = {
  points: {
    title: '💰 Points System',
    description: 'Manage staff points and track performance',
    emoji: '💰',
    commands: [
      {
        name: '/points view',
        description: 'Check points balance',
        example: '`/points view` or `/points view @User`'
      },
      {
        name: '/points add',
        description: 'Add points (Staff only)',
        example: '`/points add @User 50 Weekly bonus`'
      },
      {
        name: '/points remove',
        description: 'Remove points (Staff only)',
        example: '`/points remove @User 20 Penalty`'
      },
      {
        name: '/history',
        description: 'Export transaction history via DM',
        example: '`/history` or `/history @User`'
      }
    ]
  },
  profile: {
    title: '👤 Profile System',
    description: 'Premium profiles with validation and custom fields',
    emoji: '👤',
    commands: [
      {
        name: '/pro create',
        description: 'Create premium profile with age-DOB validation',
        example: '`/pro create display_name:"John" age:25 dob:2000-01-15`'
      },
      {
        name: '/pro edit',
        description: 'Edit bio, tags (max 5), gender, or avatar',
        example: '`/pro edit bio:"Developer"` or `/pro edit tags:"dev,admin"`'
      },
      {
        name: '/pro view',
        description: 'View profile card (points: owner only)',
        example: '`/pro view` or `/pro view @User`'
      }
    ]
  },
  info: {
    title: '📊 Info & Updates',
    description: 'Bot statistics and changelog',
    emoji: '📊',
    commands: [
      {
        name: '/info',
        description: 'Bot stats, uptime, and technical info',
        example: '`/info`'
      },
      {
        name: '/update',
        description: 'Latest bot updates and changelog',
        example: '`/update`'
      },
      {
        name: '/help',
        description: 'This help menu',
        example: '`/help`'
      },
      {
        name: '>>ping',
        description: 'Bot latency (hidden command)',
        example: '`>>ping`'
      }
    ]
  }
};

export async function execute(interaction) {
  try {
    // Defer reply to avoid timeout
    await interaction.deferReply();

    let currentPage = 0;
    const categories = Object.values(commandCategories);
    const totalPages = categories.length;

    const generatePage = (page) => {
      const category = categories[page];
      
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${category.emoji} ${category.title}`)
        .setDescription(category.description)
        .setThumbnail(interaction.client.user.displayAvatarURL());

      // Add commands as fields
      for (const cmd of category.commands) {
        embed.addFields({
          name: `${cmd.name}`,
          value: `${cmd.description}\n**Example:** ${cmd.example}`,
          inline: false
        });
      }

      // Footer
      embed.setFooter({ 
        text: `Page ${page + 1}/${totalPages} • Use buttons to navigate` 
      })
      .setTimestamp();

      return embed;
    };

    const generateButtons = (page) => {
      const row = new ActionRowBuilder();

      row.addComponents(
        new ButtonBuilder()
          .setCustomId('help_first')
          .setEmoji('⏮️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );

      row.addComponents(
        new ButtonBuilder()
          .setCustomId('help_prev')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0)
      );

      row.addComponents(
        new ButtonBuilder()
          .setCustomId('help_next')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );

      row.addComponents(
        new ButtonBuilder()
          .setCustomId('help_last')
          .setEmoji('⏭️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1)
      );

      row.addComponents(
        new ButtonBuilder()
          .setCustomId('help_close')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      );

      return row;
    };

    await interaction.editReply({
      embeds: [generatePage(currentPage)],
      components: [generateButtons(currentPage)]
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async i => {
      if (i.customId === 'help_first') {
        currentPage = 0;
      } else if (i.customId === 'help_prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === 'help_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      } else if (i.customId === 'help_last') {
        currentPage = totalPages - 1;
      } else if (i.customId === 'help_close') {
        const closedEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setDescription('✅ Help menu closed.')
          .setTimestamp();
        
        await i.update({
          embeds: [closedEmbed],
          components: []
        });
        collector.stop();
        return;
      }

      await i.update({
        embeds: [generatePage(currentPage)],
        components: [generateButtons(currentPage)]
      });
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch (error) {
        // Message might be deleted
      }
    });
  } catch (error) {
    console.error('Error executing help command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Error')
      .setDescription('Failed to load help menu. Please try again.')
      .setTimestamp();
    
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed], components: [] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    } catch (err) {
      console.error('Could not send error message:', err.message);
    }
  }
}

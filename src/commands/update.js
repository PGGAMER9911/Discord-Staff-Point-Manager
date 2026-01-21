import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPinnedUpdate, getUpdateByPage, getTotalUpdatesCount } from '../services/profileService.js';

export const data = new SlashCommandBuilder()
  .setName('update')
  .setDescription('View bot updates and changelog')
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Page number to view')
      .setRequired(false)
      .setMinValue(1)
  );

/**
 * Format update embed
 * @param {Object} update - Update object
 * @param {number} page - Current page
 * @param {number} totalPages - Total pages
 * @param {boolean} isPinned - Is this a pinned update
 * @returns {EmbedBuilder} Formatted embed
 */
function formatUpdateEmbed(update, page, totalPages, isPinned = false) {
  // Determine color based on category
  let color = 0x5865F2; // Default blue
  if (update.category === 'system') color = 0xFF0000; // Red
  else if (update.category === 'update') color = 0x5865F2; // Blue
  else if (update.category === 'info') color = 0x00FF00; // Green

  // Format date
  const date = new Date(update.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Build changes list with proper formatting
  const changesList = update.changes
    .slice(0, 6) // Limit to 6 changes per page
    .map(change => `• ${change}`)
    .join('\n');

  // Build description with dividers
  const description = [
    `🆕 **Version:** ${update.version}`,
    `📅 **Date:** ${date}`,
    `📂 **Category:** ${update.category || 'Update'}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    isPinned ? '📌 **' + update.title + '**' : '**' + update.title + '**',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    update.description,
    '',
    changesList,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `📄 Page ${page} / ${totalPages}`
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('📢 BOT UPDATE LOG')
    .setDescription(description)
    .setFooter({ text: totalPages > 1 ? 'Use buttons below to navigate' : 'Latest update' })
    .setTimestamp(new Date(update.created_at));

  return embed;
}

/**
 * Generate navigation buttons
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total pages
 * @returns {ActionRowBuilder} Button row
 */
function generateButtons(currentPage, totalPages) {
  const row = new ActionRowBuilder();

  // First button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('update_first')
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 1)
  );

  // Previous button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('update_prev')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 1)
  );

  // Page indicator button (disabled)
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('update_page')
      .setLabel(`${currentPage} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  // Next button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('update_next')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages)
  );

  // Last button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('update_last')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages)
  );

  return row;
}

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const requestedPage = interaction.options.getInteger('page') || 1;
    
    // Get total count
    const totalCount = await getTotalUpdatesCount();

    if (totalCount === 0) {
      const noUpdatesEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('📰 Bot Updates')
        .setDescription('No updates available yet.')
        .setTimestamp();
      
      return await interaction.editReply({ embeds: [noUpdatesEmbed] });
    }

    let currentPage = requestedPage;

    // Function to fetch and display update
    const displayUpdate = async (page) => {
      let update = null;
      let isPinned = false;

      // Check if page 1 - show pinned if exists
      if (page === 1) {
        const pinnedUpdate = await getPinnedUpdate();
        if (pinnedUpdate) {
          update = pinnedUpdate;
          isPinned = true;
        }
      }

      // If no pinned update, fetch by page
      if (!update) {
        update = await getUpdateByPage(page);
      }

      if (!update) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Page Not Found')
          .setDescription(`Page ${page} does not exist.\n\nTotal pages: ${totalCount}`)
          .setTimestamp();
        
        return { embeds: [errorEmbed], components: [] };
      }

      // Format embed and buttons
      const embed = formatUpdateEmbed(update, page, totalCount, isPinned);
      const buttons = totalCount > 1 ? generateButtons(page, totalCount) : null;

      return buttons 
        ? { embeds: [embed], components: [buttons] }
        : { embeds: [embed] };
    };

    // Initial display
    const initialMessage = await displayUpdate(currentPage);
    await interaction.editReply(initialMessage);

    // Only setup collector if there are multiple pages
    if (totalCount > 1) {
      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('update_'),
        time: 300000 // 5 minutes
      });

      collector.on('collect', async i => {
        if (i.customId === 'update_first') {
          currentPage = 1;
        } else if (i.customId === 'update_prev') {
          currentPage = Math.max(1, currentPage - 1);
        } else if (i.customId === 'update_next') {
          currentPage = Math.min(totalCount, currentPage + 1);
        } else if (i.customId === 'update_last') {
          currentPage = totalCount;
        }

        const updatedMessage = await displayUpdate(currentPage);
        await i.update(updatedMessage);
      });

      collector.on('end', async () => {
        try {
          await interaction.editReply({ components: [] });
        } catch (error) {
          // Message might be deleted
        }
      });
    }

  } catch (error) {
    console.error('Error executing update command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Error')
      .setDescription('Failed to fetch updates. Please try again later.')
      .setTimestamp();
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getPointsHistory } from '../services/database.js';
import { canViewHistory } from '../../config.js';
import { generateHistoryFile } from '../utils/historyGenerator.js';

export const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('View points history (sent via DM)')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to view history for (admins only)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const executor = interaction.user;
  const targetUser = interaction.options.getUser('user') || executor;

  // Check permissions
  if (!canViewHistory(executor.id, targetUser.id)) {
    return await interaction.reply({
      content: '<:error:1450781522545086599> **You do not have permission to view this user\'s history.**',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  // Step 1: Show accessing archives animation
  await interaction.editReply('<:history:1450781562059751534> **Accessing archives...**');

  try {
    // READ ONLY: Fetch history from points_history table
    // NO writes, NO modifications - database is source of truth
    const history = await getPointsHistory(targetUser.id);

    if (!history || history.length === 0) {
      return await interaction.editReply({
        content: '<:history:1450781562059751534> **No points history found for this user.**',
      });
    }

    // Step 2: Show compiling statement animation
    await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay
    await interaction.editReply('<:history:1450781562059751534> **Compiling statement...**');

    // Generate history file content
    const fileContent = await generateHistoryFile(targetUser, history);

    // Create attachment with proper filename format: Statement_<USERNAME>_<YYYY-MM-DD>.txt
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const attachment = new AttachmentBuilder(
      Buffer.from(fileContent, 'utf-8'),
      { name: `Statement_${targetUser.username}_${dateStr}.txt` }
    );

    // Try to send DM
    try {
      await executor.send({
        content: `📜 **Official Points Statement** for **${targetUser.username}**`,
        files: [attachment],
      });

      // Step 3: Final success message
      await interaction.editReply({
        content: [
          '### 📨 Statement Sent',
          '> Your detailed points statement has been sent to your DMs.'
        ].join('\n')
      });
    } catch (dmError) {
      console.error('Failed to send DM:', dmError);
      // Instant error (NO animation)
      await interaction.editReply({
        content: [
          '### ❌ Delivery Failed',
          '> **Error:** Cannot send Direct Message',
          'Please enable DMs and try again.'
        ].join('\n')
      });
    }
  } catch (error) {
    console.error('Error generating history:', error);
    
    // Better error message
    const errorMsg = error.message || 'Failed to generate history file';
    
    await interaction.editReply({
      content: `<:error:1450781522545086599> **Error:** ${errorMsg}\n> Please try again or contact an administrator.`
    });
  }
}

import { SlashCommandBuilder } from 'discord.js';
import { getUserPoints, addPoints, removePoints } from '../services/database.js';
import { canManagePoints } from '../../config.js';
import { config } from '../../config.js';
import { sendAuditLog } from '../utils/logger.js';
import { checkCooldown, setCooldown } from '../utils/cooldown.js';

export const data = new SlashCommandBuilder()
  .setName('points')
  .setDescription('Manage staff points')
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View points for yourself or another user')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to check points for (optional)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add points to a user')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to add points to')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('amount')
          .setDescription('Amount of points to add')
          .setRequired(true)
          .setMinValue(config.points.minAmount)
          .setMaxValue(config.points.maxAmount)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for points change (optional)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove points from a user')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to remove points from')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('amount')
          .setDescription('Amount of points to remove')
          .setRequired(true)
          .setMinValue(config.points.minAmount)
          .setMaxValue(config.points.maxAmount)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for points change (optional)')
          .setRequired(false)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'view') {
      await handleView(interaction);
    } else if (subcommand === 'add') {
      await handleAdd(interaction);
    } else if (subcommand === 'remove') {
      await handleRemove(interaction);
    }
  } catch (error) {
    console.error('Error executing points command:', error);
    
    const errorMessage = error.message || 'An unexpected error occurred.';
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `<:error:1450781522545086599> **Error:** ${errorMessage}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `<:error:1450781522545086599> **Error:** ${errorMessage}`, ephemeral: true });
    }
  }
}

/**
 * Handle /points view
 */
async function handleView(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  await interaction.deferReply();

  // Step 1: Show premium loading animation
  await interaction.editReply(
    '<a:points:1450781567663210506> **Fetching staff profile...**\n> Syncing records & calculating balance'
  );

  // Fetch data with realistic delay
  const points = await getUserPoints(targetUser.id);
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay

  const now = Math.floor(Date.now() / 1000); // Discord timestamp

  // Step 2: Replace with final premium design
  const response = [
    `╔══════════════╗`,
    `║  <:user:1450781532473000006> **STAFF PROFILE**   ║`,
    `╚══════════════╝`,
    ``,
    `<:user:1450781532473000006> **User:** ${targetUser}`,
    `<a:points:1450781567663210506> **Points:** **${points}**`,
    ``,
    `-# <a:time:1450781529700565073> **Retrieved:** <t:${now}:F>`,
    `────────────────────────────`
  ].join('\n');

  await interaction.editReply(response);
}


/**
 * Handle /points add with cooldown protection
 */
async function handleAdd(interaction) {
  const executor = interaction.user;
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  // CRITICAL: Discord IDs are kept as strings, never converted to Number()
  // This prevents precision loss with 18-digit snowflake IDs
  const executorId = executor.id;  // String
  const targetUserId = targetUser.id;  // String

  // Check permissions
  if (!canManagePoints(executorId, targetUserId)) {
    return await interaction.reply({
      content: '<:error:1450781522545086599> **You do not have permission to add points.**',
      ephemeral: true,
    });
  }

  // Check self-add
  if (executorId === targetUserId && !config.points.allowSelfAdd) {
    return await interaction.reply({
      content: '<:error:1450781522545086599> **You cannot add points to yourself.**',
      ephemeral: true,
    });
  }

  // RATE LIMIT: Check cooldown (anti-spam protection)
  const cooldownRemaining = checkCooldown(executorId, 'points_add');
  if (cooldownRemaining > 0) {
    return await interaction.reply({
      content: `<:time:1450781529700565073> **Slow down!** Please wait ${cooldownRemaining} second${cooldownRemaining > 1 ? 's' : ''} before using this command again.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  // Step 1: Show processing animation
  await interaction.editReply(
    '<a:time:1450781529700565073> **Processing transaction...**\n> Verifying permissions & updating balance'
  );

  try {
    // Get optional reason (null if not provided)
    const reason = interaction.options.getString('reason') || null;

    // Realistic delay for premium feel
    await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2s delay

    // Call modify_points RPC - ATOMIC TRANSACTION
    // Database handles: row locking, validation, points update, history insert
    // If ANY step fails, ENTIRE transaction rolls back
    const { before, after } = await addPoints(targetUserId, executorId, amount, reason);

    // Set cooldown AFTER successful operation
    setCooldown(executorId, 'points_add');

    // Step 2: Replace with success design
    const responseLines = [
      `<:up:1450773420362174605> <:success:1450781525812449280> **POINTS ADDED**`,
      ``,
      `**User:** ${targetUser}`,
      `**Before:** ${before}`,
      `**Added:** +${amount}`,
      `**After:** ${after}`,
    ];

    // Only show reason if it was provided
    if (reason) {
      responseLines.push(`**Reason:** ${reason}`);
    }

    responseLines.push(``, `────────────────────────────`);

    const response = responseLines.join('\n');

    await interaction.editReply(response);

    // Send audit log (async, non-blocking)
    await sendAuditLog(interaction.client, {
      type: 'ADD',
      targetUser,
      amount,
      executor,
    });
  } catch (error) {
    console.error('Add points error:', error);
    throw error;
  }
}

/**
 * Handle /points remove with cooldown protection
 */
async function handleRemove(interaction) {
  const executor = interaction.user;
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  // CRITICAL: Discord IDs are kept as strings
  const executorId = executor.id;  // String
  const targetUserId = targetUser.id;  // String

  // Check permissions
  if (!canManagePoints(executorId, targetUserId)) {
    return await interaction.reply({
      content: '<:error:1450781522545086599> **You do not have permission to remove points.**',
      ephemeral: true,
    });
  }

  // Check self-remove
  if (executorId === targetUserId && !config.points.allowSelfAdd) {
    return await interaction.reply({
      content: '<:error:1450781522545086599> **You cannot remove points from yourself.**',
      ephemeral: true,
    });
  }

  // RATE LIMIT: Check cooldown (anti-spam protection)
  const cooldownRemaining = checkCooldown(executorId, 'points_remove');
  if (cooldownRemaining > 0) {
    return await interaction.reply({
      content: `<:time:1450781529700565073> **Slow down!** Please wait ${cooldownRemaining} second${cooldownRemaining > 1 ? 's' : ''} before using this command again.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  // Step 1: Show authorization animation
  await interaction.editReply(
    '<:admin:1450781535002427476> **Authorizing deduction...**\n> Running balance validation'
  );

  try {
    // Get optional reason (null if not provided)
    const reason = interaction.options.getString('reason') || null;

    // Realistic delay for premium feel
    await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2s delay

    // Call modify_points RPC - ATOMIC TRANSACTION with negative balance validation
    // Database validates BEFORE any write
    // Uses config.points.allowNegativeBalance as single source of truth
    const { before, after } = await removePoints(
      targetUserId,
      executorId,
      amount,
      config.points.allowNegativeBalance,
      reason
    );

    // Set cooldown AFTER successful operation
    setCooldown(executorId, 'points_remove');

    // Step 2: Replace with success design
    const responseLines = [
      `<:down:1450773447813632023> <:success:1450781525812449280> **POINTS DEDUCTED**`,
      ``,
      `**User:** ${targetUser}`,
      `**Before:** ${before}`,
      `**Removed:** -${amount}`,
      `**After:** ${after}`,
    ];

    // Only show reason if it was provided
    if (reason) {
      responseLines.push(`**Reason:** ${reason}`);
    }

    responseLines.push(``, `────────────────────────────`);

    const response = responseLines.join('\n');

    await interaction.editReply(response);

    // Send audit log (async, non-blocking)
    await sendAuditLog(interaction.client, {
      type: 'REMOVE',
      targetUser,
      amount,
      executor,
    });
  } catch (error) {
    console.error('Remove points error:', error);
    
    // Map database errors to user-friendly messages
    if (error.message && error.message.includes('Insufficient points')) {
      throw new Error(`Cannot remove ${amount} points. User has insufficient balance.`);
    }
    
    throw error;
  }
}

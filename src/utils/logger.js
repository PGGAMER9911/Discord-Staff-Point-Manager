/**
 * Send audit log message to configured log channel
 * @param {Client} client - Discord client
 * @param {Object} data - Log data
 */
export async function sendAuditLog(client, data) {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  
  if (!logChannelId) {
    console.warn('LOG_CHANNEL_ID not configured. Skipping audit log.');
    return;
  }

  try {
    const channel = await client.channels.fetch(logChannelId);
    
    if (!channel || !channel.isTextBased()) {
      console.error('Invalid log channel');
      return;
    }

    const { type, targetUser, amount, executor } = data;
    
    // Use custom emojis for action type
    const emoji = type === 'ADD' ? '<:up:1450773420362174605>' : '<:down:1450773447813632023>';
    const sign = type === 'ADD' ? '+' : '-';
    const action = type === 'ADD' ? 'ADDED' : 'REMOVED';
    
    // Use Discord timestamp format (automatically converts UTC to user's local time)
    // <t:timestamp:F> = Full date and time
    const unixTimestamp = Math.floor(Date.now() / 1000);
    
    // IMPORTANT: Log ONLY user, amount, executor, time
    // NO before/after balances (database is source of truth)
    // NO reasons (privacy)
    // Logs are informational, NOT transactional data
    const message = [
      `${emoji} **POINTS ${action}**`,
      ``,
      `**User:** ${targetUser}`,
      `**Amount:** ${sign}${amount}`,
      `**By:** <:admin:1450781535002427476> ${executor}`,
      `**Time:** <a:time:1450781529700565073> <t:${unixTimestamp}:F>`,
      ``,
      `───────────────────────────────`,
    ].join('\n');

    await channel.send(message);
  } catch (error) {
    console.error('Failed to send audit log:', error);
  }
}

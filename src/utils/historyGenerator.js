/**
 * Generate bank passbook-style history file
 * @param {User} user - Discord user object
 * @param {Array} history - Array of history records from database
 * @returns {string} Formatted text file content
 */
export async function generateHistoryFile(user, history) {
  const lines = [];
  
  // Get current UTC time for generation timestamp
  const now = new Date();
  const generatedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const generatedTime = now.toISOString().split('T')[1].substring(0, 5); // HH:MM
  
  // Header
  lines.push('===================================================================');
  lines.push('                  OFFICIAL POINTS STATEMENT');
  lines.push('===================================================================');
  lines.push(`USER     : ${user.username} (ID: ${user.id})`);
  lines.push(`GENERATED: ${generatedDate} ${generatedTime} UTC`);
  lines.push('===================================================================');
  lines.push('DATE         TIME    ADMIN           ACTION      AMT    BALANCE');
  lines.push('-------------------------------------------------------------------');

  // Transaction entries - sorted by date (newest first typically)
  for (const record of history) {
    // Parse UTC timestamp
    const date = new Date(record.created_at);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toISOString().split('T')[1].substring(0, 5); // HH:MM
    
    // Format action type
    const action = record.action_type === 'ADD' ? '[ADD]   ' : '[REMOVE]';
    
    // Format amount with sign
    const amountStr = record.action_type === 'ADD' 
      ? `+${record.amount}`.padStart(7) 
      : `-${record.amount}`.padStart(7);
    
    // Format balance (after_points)
    const balanceStr = String(record.after_points).padStart(8);
    
    // Get admin name - convert ID to string first, then truncate
    const adminId = String(record.action_by_user_id);
    const adminName = `User_${adminId.substring(0, 8)}`;
    
    // Main transaction line with proper spacing
    lines.push(`${dateStr}   ${timeStr}   ${adminName.padEnd(15)} ${action}   ${amountStr}   ${balanceStr}`);
    
    // Add memo line if reason exists
    if (record.reason) {
      lines.push(`                     Memo: ${record.reason}`);
    }
    
    lines.push('');
  }

  // Closing balance (latest balance)
  const closingBalance = history.length > 0 ? history[0].after_points : 0;
  lines.push('-------------------------------------------------------------------');
  lines.push(`                     CLOSING BALANCE             ${String(closingBalance).padStart(8)}`);
  lines.push('===================================================================');
  lines.push('* This is an automated record.');
  
  return lines.join('\n');
}

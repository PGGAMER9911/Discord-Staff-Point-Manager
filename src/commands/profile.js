import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUserProfile, createUserProfile, updateUserProfile } from '../services/profileService.js';
import { getUserPoints } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('pro')
  .setDescription('Manage your premium profile')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create your premium profile')
      .addStringOption(option =>
        option
          .setName('display_name')
          .setDescription('Your display name')
          .setRequired(true)
          .setMaxLength(50)
      )
      .addIntegerOption(option =>
        option
          .setName('age')
          .setDescription('Your age')
          .setRequired(true)
          .setMinValue(13)
          .setMaxValue(100)
      )
      .addStringOption(option =>
        option
          .setName('dob')
          .setDescription('Your date of birth (YYYY-MM-DD)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('gender')
          .setDescription('Your gender')
          .setRequired(false)
          .addChoices(
            { name: 'Male', value: 'Male' },
            { name: 'Female', value: 'Female' },
            { name: 'Non-binary', value: 'Non-binary' },
            { name: 'Prefer not to say', value: 'Prefer not to say' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit your profile')
      .addStringOption(option =>
        option
          .setName('display_name')
          .setDescription('Your display name')
          .setRequired(false)
          .setMaxLength(50)
      )
      .addIntegerOption(option =>
        option
          .setName('age')
          .setDescription('Your age')
          .setRequired(false)
          .setMinValue(13)
          .setMaxValue(100)
      )
      .addStringOption(option =>
        option
          .setName('dob')
          .setDescription('Your date of birth (YYYY-MM-DD)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('bio')
          .setDescription('Your bio (max 500 characters)')
          .setRequired(false)
          .setMaxLength(500)
      )
      .addStringOption(option =>
        option
          .setName('tags')
          .setDescription('Your tags (comma-separated, max 5)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('gender')
          .setDescription('Your gender')
          .setRequired(false)
          .addChoices(
            { name: 'Male', value: 'Male' },
            { name: 'Female', value: 'Female' },
            { name: 'Non-binary', value: 'Non-binary' },
            { name: 'Prefer not to say', value: 'Prefer not to say' }
          )
      )
      .addStringOption(option =>
        option
          .setName('avatar_url')
          .setDescription('Custom avatar URL (optional)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View a profile')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to view profile for (default: yourself)')
          .setRequired(false)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'create') {
      await handleCreate(interaction);
    } else if (subcommand === 'edit') {
      await handleEdit(interaction);
    } else if (subcommand === 'view') {
      await handleView(interaction);
    }
  } catch (error) {
    console.error('Error executing profile command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Error')
      .setDescription(error.message || 'An unexpected error occurred.')
      .setTimestamp();
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

/**
 * Handle /pro create
 */
async function handleCreate(interaction) {
  const userId = interaction.user.id;
  const displayName = interaction.options.getString('display_name');
  const age = interaction.options.getInteger('age');
  const dob = interaction.options.getString('dob');
  const gender = interaction.options.getString('gender');

  await interaction.deferReply({ ephemeral: true });

  // Check if profile already exists
  const existingProfile = await getUserProfile(userId);
  if (existingProfile) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Profile Already Exists')
      .setDescription('You already have a profile! Use `/pro edit` to modify it.')
      .setTimestamp();
    
    return await interaction.editReply({ embeds: [errorEmbed] });
  }

  try {
    // Create profile
    const profile = await createUserProfile(userId, {
      displayName,
      age,
      dob,
      gender
    });

    // Success embed
    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Profile Created Successfully!')
      .setDescription('Your premium profile has been created.')
      .addFields(
        { name: '👤 Display Name', value: profile.display_name, inline: true },
        { name: '🎂 Age', value: profile.age.toString(), inline: true },
        { name: '📅 DOB', value: profile.dob, inline: true }
      )
      .setFooter({ text: 'Use /pro view to see your full profile' })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    if (error.message.startsWith('DATE_INVALID:')) {
      const errorMsg = error.message.replace('DATE_INVALID: ', '');
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Invalid Date')
        .setDescription(errorMsg)
        .addFields({ name: 'Example', value: '`2000-05-27`' })
        .setTimestamp();
      
      return await interaction.editReply({ embeds: [errorEmbed] });
    }
    
    if (error.message === 'AGE_DOB_MISMATCH') {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ Age-DOB Mismatch')
        .setDescription('The age you entered does not match your date of birth.')
        .addFields(
          { name: 'What to do?', value: 'Double-check your age and date of birth, then try again.' }
        )
        .setTimestamp();
      
      return await interaction.editReply({ embeds: [errorEmbed] });
    }
    
    throw error;
  }
}

/**
 * Handle /pro edit
 */
async function handleEdit(interaction) {
  const userId = interaction.user.id;
  const displayName = interaction.options.getString('display_name');
  const age = interaction.options.getInteger('age');
  const dob = interaction.options.getString('dob');
  const bio = interaction.options.getString('bio');
  const tagsRaw = interaction.options.getString('tags');
  const gender = interaction.options.getString('gender');
  const avatarUrl = interaction.options.getString('avatar_url');

  await interaction.deferReply({ ephemeral: true });

  // Animation Step 1
  const loadingEmbed1 = new EmbedBuilder()
    .setColor(0x5865F2)
    .setDescription('🔍 **Verifying changes...**')
    .setTimestamp();
  
  await interaction.editReply({ embeds: [loadingEmbed1] });

  // Check if profile exists
  const profile = await getUserProfile(userId);
  if (!profile) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ No Profile Found')
      .setDescription('You don\'t have a profile yet! Use `/pro create` first.')
      .setTimestamp();
    
    return await interaction.editReply({ embeds: [errorEmbed] });
  }

  await new Promise(resolve => setTimeout(resolve, 700));

  // Animation Step 2
  const loadingEmbed2 = new EmbedBuilder()
    .setColor(0x5865F2)
    .setDescription('📝 **Updating your profile...**')
    .setTimestamp();
  
  await interaction.editReply({ embeds: [loadingEmbed2] });

  // Build update object
  const updates = {};
  if (displayName !== null) updates.displayName = displayName;
  if (age !== null) updates.age = age;
  if (dob !== null) updates.dob = dob;
  if (bio !== null) updates.bio = bio;
  if (gender !== null) updates.gender = gender;
  if (avatarUrl !== null) updates.avatarUrl = avatarUrl;
  
  if (tagsRaw !== null) {
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (tags.length > 5) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Too Many Tags')
        .setDescription('You can only have up to 5 tags.')
        .setTimestamp();
      
      return await interaction.editReply({ embeds: [errorEmbed] });
    }
    updates.tags = tags;
  }

  if (Object.keys(updates).length === 0) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ No Changes Provided')
      .setDescription('Please specify at least one field to update.')
      .setTimestamp();
    
    return await interaction.editReply({ embeds: [errorEmbed] });
  }

  try {
    // Update profile
    const updatedProfile = await updateUserProfile(userId, updates);

    await new Promise(resolve => setTimeout(resolve, 500));

    // Success embed
    const updatedFields = Object.keys(updates)
      .map(key => {
        const fieldMap = {
          displayName: 'Display Name',
          age: 'Age',
          dob: 'Date of Birth',
          bio: 'Bio',
          tags: 'Tags',
          gender: 'Gender',
          avatarUrl: 'Avatar URL'
        };
        return fieldMap[key] || key;
      })
      .join(', ');

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Profile Updated Successfully!')
      .setDescription(`**Updated:** ${updatedFields}`)
      .setFooter({ text: 'Use /pro view to see your changes' })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    if (error.message.startsWith('DATE_INVALID:')) {
      const errorMsg = error.message.replace('DATE_INVALID: ', '');
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Invalid Date')
        .setDescription(errorMsg)
        .addFields({ name: 'Example', value: '`2000-05-27`' })
        .setTimestamp();
      
      return await interaction.editReply({ embeds: [errorEmbed] });
    }
    
    if (error.message === 'AGE_DOB_MISMATCH') {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ Age-DOB Mismatch')
        .setDescription('The age you entered does not match your date of birth.')
        .setTimestamp();
      
      return await interaction.editReply({ embeds: [errorEmbed] });
    }
    
    throw error;
  }
}

/**
 * Handle /pro view
 */
async function handleView(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const isOwnProfile = targetUser.id === interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  // Optional animation
  await interaction.editReply({ content: '🔍 Fetching profile data...' });
  await new Promise(r => setTimeout(r, 400));

  // Fetch FRESH profile data (no caching)
  const profile = await getUserProfile(targetUser.id);

  if (!profile) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ No Profile Found')
      .setDescription(`${targetUser} hasn't created a profile yet.`)
      .setFooter({ text: isOwnProfile ? 'Use /pro create to get started!' : '' })
      .setTimestamp();
    
    return await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
  }

  // Build premium profile embed
  const profileEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`👤 ${profile.display_name}`)
    .setDescription(profile.bio || '*No bio set*')
    .setThumbnail(profile.avatar_url || targetUser.displayAvatarURL({ size: 256 }));

  // About section
  const aboutValue = [
    `**Age:** ${profile.age}`,
    `**DOB:** ${profile.dob}`,
    profile.gender ? `**Gender:** ${profile.gender}` : null,
    `**Joined:** <t:${Math.floor(new Date(profile.created_at).getTime() / 1000)}:R>`
  ].filter(v => v !== null).join('\n');

  profileEmbed.addFields({ name: '🧠 About', value: aboutValue });

  // Tags section
  if (profile.tags && profile.tags.length > 0) {
    const tagsValue = profile.tags.map(tag => `\`${tag}\``).join(' ');
    profileEmbed.addFields({ name: '🏷️ Tags', value: tagsValue });
  }

  // Stats section (fetch fresh points)
  try {
    const points = await getUserPoints(targetUser.id);
    if (isOwnProfile) {
      profileEmbed.addFields({ name: '⭐ Stats', value: `**Points:** ${points}` });
    } else {
      profileEmbed.addFields({ 
        name: '⭐ Stats', 
        value: `*Points are private and visible only to the profile owner*` 
      });
    }
  } catch (error) {
    console.error('Error fetching points:', error);
    if (!isOwnProfile) {
      profileEmbed.addFields({ 
        name: '⭐ Stats', 
        value: `*Stats are private*` 
      });
    }
  }

  // Footer
  profileEmbed.setFooter({ text: `Profile System • Last updated` })
    .setTimestamp(new Date(profile.updated_at));

  // FINAL OUTPUT - Use followUp() to avoid Discord cache issues
  await interaction.followUp({ embeds: [profileEmbed], ephemeral: true });
}

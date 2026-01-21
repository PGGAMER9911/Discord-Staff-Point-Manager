import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Deploy commands script
 * Run this to register/update slash commands
 */
async function deploy() {
  const commands = [];
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  // Load all command data
  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(`file://${filePath}`);
    
    if ('data' in command) {
      commands.push(command.data.toJSON());
      console.log(`📝 Loaded: ${command.data.name}`);
    }
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`\n🔄 Deploying ${commands.length} commands to Discord...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log(`✅ Successfully deployed ${data.length} commands!\n`);
    
    data.forEach(cmd => {
      console.log(`  - /${cmd.name}`);
    });
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

deploy();

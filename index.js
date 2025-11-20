const PORT = process.env.PORT || 3000;
require('http').createServer((req, res) => res.end('OK')).listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } from 'discord.js';
import axios from 'axios';
import fs from 'fs';

const CONFIG_FILE = 'config.json';

const defaultConfig = {
    logChannel: null,
    prefix: '!',
    roles: {
        guard: '1424697474978938920',
        infantryHeavyArtillery: '1424697278588784670',
        enlisted: '1424320589178601472'
    },
    pings: {
        guard: '728201873366056992',
        others: '1093789546249981972',
        altReview: '1424372983191044217'
    },
    invites: {
        guard: 'https://discord.gg/HCvMxhA9HX',
        others: 'https://discord.gg/xF6Tv3GQ8u'
    },
    panel: {
        title: '🎖️ Rekrut Enlistment Application',
        description: 'Welcome to the **Rekrut Enlistment System**!\n\n**Join the ranks and serve with honor.**\n\nClick the button below to begin your application process.\n\n**Requirements:**\n• Valid Roblox account\n• Active Discord account\n• Commitment to training\n\n**What happens next?**\n1. Fill out the application form\n2. Your application will be reviewed\n3. Upon approval, you\'ll receive your roles and server invite\n4. Complete your Rekrut Training',
        buttonText: '📝 Start Application',
        color: '#FFD700'
    },
    dmMessage: {
        title: '🎉 Application Accepted!',
        description: 'Congratulations! Your **Rekrut Enlistment Application** has been {status}!',
        nextSteps: '1. Join your division server using the link below\n2. Complete your Rekrut Training\n3. Serve with honor!',
        color: '#00FF00'
    },
    altDetection: {
        enabled: true,
        minAccountAgeDays: 7,
        requireAvatar: true,
        requireRoles: false
    }
};

function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}

let config = { ...defaultConfig };

if (fs.existsSync(CONFIG_FILE)) {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = deepMerge(defaultConfig, savedConfig);
} else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const pendingApplications = new Map();

async function verifyRobloxUsername(username) {
    try {
        const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [username],
            excludeBannedUsers: false
        });
        
        if (response.data.data && response.data.data.length > 0) {
            return {
                valid: true,
                user: response.data.data[0]
            };
        }
        return { valid: false };
    } catch (error) {
        console.error('Error verifying Roblox username:', error.message);
        return { valid: false, error: true };
    }
}

function isLikelySuspiciousAccount(member) {
    if (!config.altDetection.enabled) return false;
    
    const accountAge = Date.now() - member.user.createdAt.getTime();
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
    
    const hasDefaultAvatar = !member.user.avatar;
    const isNewAccount = daysSinceCreation < config.altDetection.minAccountAgeDays;
    const hasNoRoles = member.roles.cache.size <= 1;
    
    const suspiciousIndicators = [];
    
    if (isNewAccount) suspiciousIndicators.push('New account');
    if (config.altDetection.requireAvatar && hasDefaultAvatar) suspiciousIndicators.push('No avatar');
    if (config.altDetection.requireRoles && hasNoRoles) suspiciousIndicators.push('No roles');
    
    return suspiciousIndicators.length > 0 ? suspiciousIndicators : false;
}

function setupEventHandlers(client) {

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
    console.log(`🎮 Command prefix: ${config.prefix}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;
    
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    if (command === 'config') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need Administrator permission to use this command.');
        }
        
        const subcommand = args[0]?.toLowerCase();
        
        if (!subcommand) {
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('⚙️ Configuration System')
                .setDescription('Use these commands to configure the bot:')
                .addFields(
                    { name: `${config.prefix}config roles`, value: 'View/Edit role IDs', inline: false },
                    { name: `${config.prefix}config pings`, value: 'View/Edit ping role IDs', inline: false },
                    { name: `${config.prefix}config invites`, value: 'View/Edit invite links', inline: false },
                    { name: `${config.prefix}config panel`, value: 'View/Edit application panel', inline: false },
                    { name: `${config.prefix}config dm`, value: 'View/Edit DM message', inline: false },
                    { name: `${config.prefix}config altdetection`, value: 'View/Edit alt detection settings', inline: false },
                    { name: `${config.prefix}config view`, value: 'View full configuration', inline: false }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        if (subcommand === 'view') {
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('📋 Current Configuration')
                .addFields(
                    { name: '🎭 Roles', value: `Guard: \`${config.roles.guard}\`\nInfantry/Heavy/Artillery: \`${config.roles.infantryHeavyArtillery}\`\nEnlisted: \`${config.roles.enlisted}\``, inline: false },
                    { name: '🔔 Pings', value: `Guard: \`${config.pings.guard}\`\nOthers: \`${config.pings.others}\`\nAlt Review: \`${config.pings.altReview}\``, inline: false },
                    { name: '🔗 Invites', value: `Guard: ${config.invites.guard}\nOthers: ${config.invites.others}`, inline: false },
                    { name: '🛡️ Alt Detection', value: `Enabled: ${config.altDetection.enabled}\nMin Account Age: ${config.altDetection.minAccountAgeDays} days\nRequire Avatar: ${config.altDetection.requireAvatar}\nRequire Roles: ${config.altDetection.requireRoles}`, inline: false }
                )
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }
        
        if (subcommand === 'roles') {
            const action = args[1]?.toLowerCase();
            
            if (action === 'guard') {
                const roleId = args[2];
                if (!roleId) return message.reply('❌ Usage: `!config roles guard <role_id>`');
                config.roles.guard = roleId;
                saveConfig();
                return message.reply(`✅ Guard role set to: \`${roleId}\``);
            }
            
            if (action === 'infantry') {
                const roleId = args[2];
                if (!roleId) return message.reply('❌ Usage: `!config roles infantry <role_id>`');
                config.roles.infantryHeavyArtillery = roleId;
                saveConfig();
                return message.reply(`✅ Infantry/Heavy/Artillery role set to: \`${roleId}\``);
            }
            
            if (action === 'enlisted') {
                const roleId = args[2];
                if (!roleId) return message.reply('❌ Usage: `!config roles enlisted <role_id>`');
                config.roles.enlisted = roleId;
                saveConfig();
                return message.reply(`✅ Enlisted role set to: \`${roleId}\``);
            }
            
            return message.reply('📋 **Role Configuration**\nUsage:\n`!config roles guard <role_id>`\n`!config roles infantry <role_id>`\n`!config roles enlisted <role_id>`');
        }
        
        if (subcommand === 'pings') {
            const action = args[1]?.toLowerCase();
            
            if (action === 'guard') {
                const roleId = args[2];
                if (!roleId) return message.reply('❌ Usage: `!config pings guard <role_id>`');
                config.pings.guard = roleId;
                saveConfig();
                return message.reply(`✅ Guard ping role set to: \`${roleId}\``);
            }
            
            if (action === 'others') {
                const roleId = args[2];
                if (!roleId) return message.reply('❌ Usage: `!config pings others <role_id>`');
                config.pings.others = roleId;
                saveConfig();
                return message.reply(`✅ Others ping role set to: \`${roleId}\``);
            }
            
            if (action === 'altreview') {
                const roleId = args[2];
                if (!roleId) return message.reply('❌ Usage: `!config pings altreview <role_id>`');
                config.pings.altReview = roleId;
                saveConfig();
                return message.reply(`✅ Alt review ping role set to: \`${roleId}\``);
            }
            
            return message.reply('📋 **Ping Configuration**\nUsage:\n`!config pings guard <role_id>`\n`!config pings others <role_id>`\n`!config pings altreview <role_id>`');
        }
        
        if (subcommand === 'invites') {
            const action = args[1]?.toLowerCase();
            
            if (action === 'guard') {
                const invite = args[2];
                if (!invite) return message.reply('❌ Usage: `!config invites guard <invite_link>`');
                config.invites.guard = invite;
                saveConfig();
                return message.reply(`✅ Guard invite set to: ${invite}`);
            }
            
            if (action === 'others') {
                const invite = args[2];
                if (!invite) return message.reply('❌ Usage: `!config invites others <invite_link>`');
                config.invites.others = invite;
                saveConfig();
                return message.reply(`✅ Others invite set to: ${invite}`);
            }
            
            return message.reply('📋 **Invite Configuration**\nUsage:\n`!config invites guard <invite_link>`\n`!config invites others <invite_link>`');
        }
        
        if (subcommand === 'panel') {
            const action = args[1]?.toLowerCase();
            
            if (action === 'title') {
                const title = args.slice(2).join(' ');
                if (!title) return message.reply('❌ Usage: `!config panel title <text>`');
                config.panel.title = title;
                saveConfig();
                return message.reply(`✅ Panel title updated!`);
            }
            
            if (action === 'description') {
                const desc = args.slice(2).join(' ');
                if (!desc) return message.reply('❌ Usage: `!config panel description <text>`');
                config.panel.description = desc;
                saveConfig();
                return message.reply(`✅ Panel description updated!`);
            }
            
            if (action === 'button') {
                const text = args.slice(2).join(' ');
                if (!text) return message.reply('❌ Usage: `!config panel button <text>`');
                config.panel.buttonText = text;
                saveConfig();
                return message.reply(`✅ Panel button text updated!`);
            }
            
            if (action === 'color') {
                const color = args[2];
                if (!color) return message.reply('❌ Usage: `!config panel color <hex_color>`');
                config.panel.color = color;
                saveConfig();
                return message.reply(`✅ Panel color updated!`);
            }
            
            return message.reply('📋 **Panel Configuration**\nUsage:\n`!config panel title <text>`\n`!config panel description <text>`\n`!config panel button <text>`\n`!config panel color <hex>`');
        }
        
        if (subcommand === 'dm') {
            const action = args[1]?.toLowerCase();
            
            if (action === 'title') {
                const title = args.slice(2).join(' ');
                if (!title) return message.reply('❌ Usage: `!config dm title <text>`');
                config.dmMessage.title = title;
                saveConfig();
                return message.reply(`✅ DM title updated!`);
            }
            
            if (action === 'description') {
                const desc = args.slice(2).join(' ');
                if (!desc) return message.reply('❌ Usage: `!config dm description <text>` (use {status} for status placeholder)');
                config.dmMessage.description = desc;
                saveConfig();
                return message.reply(`✅ DM description updated!`);
            }
            
            if (action === 'steps') {
                const steps = args.slice(2).join(' ');
                if (!steps) return message.reply('❌ Usage: `!config dm steps <text>`');
                config.dmMessage.nextSteps = steps;
                saveConfig();
                return message.reply(`✅ DM next steps updated!`);
            }
            
            return message.reply('📋 **DM Configuration**\nUsage:\n`!config dm title <text>`\n`!config dm description <text>`\n`!config dm steps <text>`');
        }
        
        if (subcommand === 'altdetection') {
            const action = args[1]?.toLowerCase();
            
            if (action === 'toggle') {
                config.altDetection.enabled = !config.altDetection.enabled;
                saveConfig();
                return message.reply(`✅ Alt detection ${config.altDetection.enabled ? 'enabled' : 'disabled'}!`);
            }
            
            if (action === 'minage') {
                const days = parseInt(args[2]);
                if (isNaN(days)) return message.reply('❌ Usage: `!config altdetection minage <days>`');
                config.altDetection.minAccountAgeDays = days;
                saveConfig();
                return message.reply(`✅ Minimum account age set to ${days} days!`);
            }
            
            if (action === 'avatar') {
                config.altDetection.requireAvatar = !config.altDetection.requireAvatar;
                saveConfig();
                return message.reply(`✅ Avatar requirement ${config.altDetection.requireAvatar ? 'enabled' : 'disabled'}!`);
            }
            
            if (action === 'roles') {
                config.altDetection.requireRoles = !config.altDetection.requireRoles;
                saveConfig();
                return message.reply(`✅ Roles requirement ${config.altDetection.requireRoles ? 'enabled' : 'disabled'}!`);
            }
            
            return message.reply('📋 **Alt Detection Configuration**\nUsage:\n`!config altdetection toggle` - Enable/disable alt detection\n`!config altdetection minage <days>` - Set minimum account age\n`!config altdetection avatar` - Toggle avatar requirement\n`!config altdetection roles` - Toggle roles requirement');
        }
    }
    
    if (command === 'setlogchannel') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need Administrator permission to use this command.');
        }
        
        const channel = message.mentions.channels.first() || message.channel;
        config.logChannel = channel.id;
        saveConfig();
        
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Log Channel Set')
            .setDescription(`Applications will now be logged in ${channel}`)
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
    
    if (command === 'createpanel') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need Administrator permission to use this command.');
        }
        
        const panelEmbed = new EmbedBuilder()
            .setColor(config.panel.color)
            .setTitle(config.panel.title)
            .setDescription(config.panel.description)
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'Good luck, Recruit!' })
            .setTimestamp();
        
        const button = new ButtonBuilder()
            .setCustomId('start_application')
            .setLabel(config.panel.buttonText)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎖️');
        
        const row = new ActionRowBuilder().addComponents(button);
        
        await message.channel.send({ embeds: [panelEmbed], components: [row] });
        await message.delete().catch(() => {});
    }
    
    if (command === 'setprefix') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need Administrator permission to use this command.');
        }
        
        const newPrefix = args[0];
        if (!newPrefix) {
            return message.reply('❌ Please provide a new prefix. Example: `!setprefix ?`');
        }
        
        config.prefix = newPrefix;
        saveConfig();
        
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Prefix Updated')
            .setDescription(`Command prefix is now: \`${newPrefix}\``)
            .setTimestamp();
        
        return message.reply({ embeds: [embed] });
    }
    
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('📚 Rekrut Enlistment Bot - Commands')
            .setDescription('Here are all available commands:')
            .addFields(
                { name: `${config.prefix}createpanel`, value: 'Create the enlistment application panel', inline: false },
                { name: `${config.prefix}setlogchannel [#channel]`, value: 'Set the log channel for applications', inline: false },
                { name: `${config.prefix}setprefix [prefix]`, value: 'Change the command prefix', inline: false },
                { name: `${config.prefix}config`, value: 'View all configuration options', inline: false },
                { name: `${config.prefix}config roles`, value: 'Configure role IDs', inline: false },
                { name: `${config.prefix}config pings`, value: 'Configure ping role IDs', inline: false },
                { name: `${config.prefix}config invites`, value: 'Configure invite links', inline: false },
                { name: `${config.prefix}config panel`, value: 'Configure panel appearance', inline: false },
                { name: `${config.prefix}config dm`, value: 'Configure DM messages', inline: false },
                { name: `${config.prefix}config altdetection`, value: 'Configure alt detection', inline: false },
                { name: `${config.prefix}help`, value: 'Show this help message', inline: false }
            )
            .setFooter({ text: 'All commands require Administrator permission' })
            .setTimestamp();
        
        return message.reply({ embeds: [helpEmbed] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'start_application') {
            const modal = new ModalBuilder()
                .setCustomId('enlistment_application')
                .setTitle('Rekrut Enlistment Application');
            
            const robloxInput = new TextInputBuilder()
                .setCustomId('roblox_username')
                .setLabel('What is your Roblox Username?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter your Roblox username')
                .setRequired(true)
                .setMaxLength(20);
            
            const discordInput = new TextInputBuilder()
                .setCustomId('discord_username')
                .setLabel('What is your Discord Username?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter your Discord username')
                .setRequired(true)
                .setMaxLength(32);
            
            const timezoneInput = new TextInputBuilder()
                .setCustomId('timezone')
                .setLabel('What is your Timezone?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('NA/SA, EU/AF, or AS/OC')
                .setRequired(true)
                .setMaxLength(10);
            
            const divisionInput = new TextInputBuilder()
                .setCustomId('division')
                .setLabel('Which Division do you wish to join?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Guard, Infantry, Heavy, or Artillery')
                .setRequired(true)
                .setMaxLength(20);
            
            const activityInput = new TextInputBuilder()
                .setCustomId('activity')
                .setLabel('How often are you active? (1-10)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter a number from 1 to 10')
                .setRequired(true)
                .setMaxLength(2);
            
            const row1 = new ActionRowBuilder().addComponents(robloxInput);
            const row2 = new ActionRowBuilder().addComponents(discordInput);
            const row3 = new ActionRowBuilder().addComponents(timezoneInput);
            const row4 = new ActionRowBuilder().addComponents(divisionInput);
            const row5 = new ActionRowBuilder().addComponents(activityInput);
            
            modal.addComponents(row1, row2, row3, row4, row5);
            
            await interaction.showModal(modal);
        }
        
        if (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('decline_')) {
            const userId = interaction.customId.split('_')[1];
            const applicationData = pendingApplications.get(userId);
            
            if (!applicationData) {
                return interaction.reply({ content: '❌ Application data not found.', ephemeral: true });
            }
            
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            
            if (!member) {
                pendingApplications.delete(userId);
                return interaction.reply({ content: '❌ User not found in server.', ephemeral: true });
            }
            
            if (interaction.customId.startsWith('approve_')) {
                await processApplication(applicationData, member, interaction.guild, false);
                
                const approveEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Application Approved')
                    .setDescription(`${member.user.tag}'s application has been manually approved by ${interaction.user.tag}`)
                    .setTimestamp();
                
                await interaction.update({ embeds: [approveEmbed], components: [] });
                pendingApplications.delete(userId);
            } else {
                try {
                    await member.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Application Declined')
                            .setDescription('Your enlistment application has been declined by the review team. You have been removed from the server.')
                            .setTimestamp()]
                    }).catch(() => {});
                    
                    await member.ban({ reason: 'Application declined - Suspected alt account' });
                    
                    const declineEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('❌ Application Declined & Banned')
                        .setDescription(`${member.user.tag}'s application has been declined by ${interaction.user.tag}\n\nUser has been banned from the server.`)
                        .setTimestamp();
                    
                    await interaction.update({ embeds: [declineEmbed], components: [] });
                    pendingApplications.delete(userId);
                } catch (error) {
                    await interaction.reply({ content: '❌ Failed to ban user. Missing permissions.', ephemeral: true });
                }
            }
        }
    }
    
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'enlistment_application') {
            await interaction.deferReply({ ephemeral: true });
            
            const robloxUsername = interaction.fields.getTextInputValue('roblox_username').trim();
            const discordUsername = interaction.fields.getTextInputValue('discord_username').trim();
            const timezone = interaction.fields.getTextInputValue('timezone').trim();
            const division = interaction.fields.getTextInputValue('division').trim();
            const activity = interaction.fields.getTextInputValue('activity').trim();
            
            const validTimezones = ['NA/SA', 'EU/AF', 'AS/OC'];
            const normalizedTimezone = timezone.toUpperCase();
            
            if (!validTimezones.includes(normalizedTimezone)) {
                try {
                    await interaction.member.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Application Error - Invalid Timezone')
                            .setDescription(`**Invalid timezone:** You entered "${timezone}"\n\n**Valid options:**\n• NA/SA (North/South America)\n• EU/AF (Europe/Africa)\n• AS/OC (Asia/Oceania)\n\nPlease submit your application again with a correct timezone.`)
                            .setTimestamp()]
                    }).catch(() => {});
                } catch (e) {}
                
                return interaction.editReply({
                    content: '❌ Invalid timezone. Please use one of: NA/SA, EU/AF, or AS/OC. Check your DMs for more information.',
                    ephemeral: true
                });
            }
            
            const validDivisions = ['guard', 'infantry', 'heavy', 'artillery'];
            const normalizedDivision = division.toLowerCase();
            
            if (!validDivisions.includes(normalizedDivision)) {
                try {
                    await interaction.member.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Application Error - Invalid Division')
                            .setDescription(`**Invalid division:** You entered "${division}"\n\n**Valid options:**\n• Guard\n• Infantry\n• Heavy\n• Artillery\n\nPlease submit your application again with a correct division choice.`)
                            .setTimestamp()]
                    }).catch(() => {});
                } catch (e) {}
                
                return interaction.editReply({
                    content: '❌ Invalid division. Please choose: Guard, Infantry, Heavy, or Artillery. Check your DMs for more information.',
                    ephemeral: true
                });
            }
            
            const activityNum = parseInt(activity);
            if (isNaN(activityNum) || activityNum < 1 || activityNum > 10) {
                try {
                    await interaction.member.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Application Error - Invalid Activity Level')
                            .setDescription(`**Invalid activity level:** You entered "${activity}"\n\nActivity level must be a number between 1 and 10.\n\nPlease submit your application again with a valid number.`)
                            .setTimestamp()]
                    }).catch(() => {});
                } catch (e) {}
                
                return interaction.editReply({
                    content: '❌ Activity level must be a number between 1 and 10. Check your DMs for more information.',
                    ephemeral: true
                });
            }
            
            const robloxVerification = await verifyRobloxUsername(robloxUsername);
            
            if (!robloxVerification.valid) {
                try {
                    await interaction.member.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('❌ Application Error - Invalid Roblox Username')
                            .setDescription(`**Invalid Roblox username:** "${robloxUsername}"\n\nThis Roblox username does not exist. Please check your spelling and make sure you entered your exact Roblox username.\n\n**How to find your Roblox username:**\n1. Go to roblox.com\n2. Log in to your account\n3. Click on your profile\n4. Copy your username exactly as it appears\n\nPlease submit your application again with the correct Roblox username.`)
                            .setTimestamp()]
                    }).catch(() => {});
                } catch (e) {}
                
                return interaction.editReply({
                    content: '❌ The Roblox username you provided does not exist. Please check your DMs for more information and try again.',
                    ephemeral: true
                });
            }
            
            const member = interaction.member;
            const suspiciousReasons = isLikelySuspiciousAccount(member);
            
            const applicationData = {
                userId: interaction.user.id,
                robloxUsername: robloxVerification.user.name,
                robloxId: robloxVerification.user.id,
                discordUsername,
                timezone: normalizedTimezone,
                division: normalizedDivision,
                activity: activityNum,
                timestamp: new Date().toISOString()
            };
            
            if (suspiciousReasons && suspiciousReasons.length > 0) {
                pendingApplications.set(interaction.user.id, applicationData);
                
                if (config.logChannel) {
                    const logChannel = await client.channels.fetch(config.logChannel);
                    
                    const reviewEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⚠️ SUSPECTED ALT ACCOUNT - Manual Review Required')
                        .setDescription(`<@${member.id}> (${member.user.tag}) has submitted an application but is flagged as a potential alt account.`)
                        .addFields(
                            { name: '📋 Application Details', value: '\u200B', inline: false },
                            { name: '🎮 Roblox Username', value: `${applicationData.robloxUsername} (ID: ${applicationData.robloxId})`, inline: true },
                            { name: '💬 Discord Username', value: discordUsername, inline: true },
                            { name: '🌍 Timezone', value: normalizedTimezone, inline: true },
                            { name: '🎖️ Division Choice', value: division.charAt(0).toUpperCase() + division.slice(1), inline: true },
                            { name: '📊 Activity Level', value: `${activityNum}/10`, inline: true },
                            { name: '\u200B', value: '\u200B', inline: true },
                            { name: '⚠️ Suspicious Indicators', value: suspiciousReasons.join(', '), inline: false },
                            { name: '📅 Account Age', value: `${Math.floor((Date.now() - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days`, inline: true },
                            { name: '🖼️ Has Avatar', value: member.user.avatar ? 'Yes' : 'No', inline: true },
                            { name: '🎭 Role Count', value: `${member.roles.cache.size - 1}`, inline: true }
                        )
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: `User ID: ${member.id}` })
                        .setTimestamp();
                    
                    const approveButton = new ButtonBuilder()
                        .setCustomId(`approve_${member.id}`)
                        .setLabel('✅ Approve')
                        .setStyle(ButtonStyle.Success);
                    
                    const declineButton = new ButtonBuilder()
                        .setCustomId(`decline_${member.id}`)
                        .setLabel('❌ Decline & Ban')
                        .setStyle(ButtonStyle.Danger);
                    
                    const row = new ActionRowBuilder().addComponents(approveButton, declineButton);
                    
                    await logChannel.send({
                        content: `<@&${config.pings.altReview}>`,
                        embeds: [reviewEmbed],
                        components: [row]
                    });
                }
                
                try {
                    await interaction.member.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#FFA500')
                            .setTitle('⏳ Application Pending Review')
                            .setDescription('Thank you for submitting your application!\n\nYour application is currently pending manual review by our team. This is a standard security procedure.\n\nYou will be notified once your application has been reviewed.')
                            .setTimestamp()]
                    }).catch(() => {});
                } catch (e) {}
                
                return interaction.editReply({
                    content: '✅ Your application has been submitted and is pending manual review. You will be notified once reviewed.',
                    ephemeral: true
                });
            } else {
                await processApplication(applicationData, member, interaction.guild, true);
                
                return interaction.editReply({
                    content: '✅ Your application has been submitted successfully! Check your DMs for further instructions.',
                    ephemeral: true
                });
            }
        }
    }
});

async function processApplication(applicationData, member, guild, autoAccepted) {
    const { robloxUsername, robloxId, discordUsername, timezone, division, activity, userId } = applicationData;
    
    const isGuard = division === 'guard';
    const divisionRole = isGuard ? config.roles.guard : config.roles.infantryHeavyArtillery;
    const enlistedRole = config.roles.enlisted;
    const inviteLink = isGuard ? config.invites.guard : config.invites.others;
    const pingRole = isGuard ? config.pings.guard : config.pings.others;
    
    try {
        await member.roles.add(divisionRole);
        await member.roles.add(enlistedRole);
    } catch (error) {
        console.error('Error assigning roles:', error.message);
    }
    
    try {
        await member.setNickname(robloxUsername);
    } catch (error) {
        console.error('Error setting nickname:', error.message);
    }
    
    try {
        const dmDescription = config.dmMessage.description.replace('{status}', autoAccepted ? 'accepted' : 'manually approved');
        
        const dmEmbed = new EmbedBuilder()
            .setColor(config.dmMessage.color)
            .setTitle(config.dmMessage.title)
            .setDescription(dmDescription)
            .addFields(
                { name: '🎖️ Division', value: division.charAt(0).toUpperCase() + division.slice(1), inline: true },
                { name: '🎭 Roles Assigned', value: 'Enlisted + Division Role', inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: '📬 Next Steps', value: config.dmMessage.nextSteps, inline: false },
                { name: '🔗 Division Server', value: `[Click here to join](${inviteLink})`, inline: false }
            )
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'Welcome to the ranks!' })
            .setTimestamp();
        
        await member.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.error('Error sending DM:', error.message);
    }
    
    if (config.logChannel) {
        try {
            const logChannel = await client.channels.fetch(config.logChannel);
            
            const logEmbed = new EmbedBuilder()
                .setColor('#4169E1')
                .setTitle(`${member.user.tag}'s 'Rekrut Enlistment' Application ${autoAccepted ? 'Submitted' : 'Manually Approved'}`)
                .setDescription(`**Application ${autoAccepted ? 'Auto-Accepted' : 'Approved'}**`)
                .addFields(
                    { name: '1. What is your Roblox Username?', value: `${robloxUsername} (ID: ${robloxId})`, inline: false },
                    { name: '2. What is your Discord Username?', value: discordUsername, inline: false },
                    { name: '3. What is your Timezone?', value: timezone, inline: false },
                    { name: '4. If the Application is Accepted what Division you wish to join?', value: division.charAt(0).toUpperCase() + division.slice(1), inline: false },
                    { name: '6. How often are you active (range from 1-10)', value: `${activity}/10`, inline: false },
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: '✅ Status', value: 'ACCEPTED', inline: true },
                    { name: '🎭 Roles Given', value: `<@&${enlistedRole}>, <@&${divisionRole}>`, inline: true },
                    { name: '👤 Nickname Set', value: robloxUsername, inline: true },
                    { name: '📅 Submitted', value: `<t:${Math.floor(new Date(applicationData.timestamp).getTime() / 1000)}:R>`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `User ID: ${userId}` })
                .setTimestamp();
            
            await logChannel.send({
                content: `<@&${pingRole}>`,
                embeds: [logEmbed]
            });
        } catch (error) {
            console.error('Error sending to log channel:', error.message);
        }
    }
}

}

async function startBot() {
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    
    if (!DISCORD_BOT_TOKEN) {
        console.error('❌ ERROR: DISCORD_BOT_TOKEN is not set in environment variables.');
        console.error('Please add your Discord bot token as a secret.');
        process.exit(1);
    }
    
    try {
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });
        
        setupEventHandlers(client);
        
        await client.login(DISCORD_BOT_TOKEN);
        console.log('✅ Bot successfully connected to Discord!');
    } catch (error) {
        console.error('❌ Failed to login:', error.message);
        console.error('Please make sure your Discord bot token is correct.');
        process.exit(1);
    }
}

startBot();

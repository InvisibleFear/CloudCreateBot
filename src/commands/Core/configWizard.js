import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    LabelBuilder,
    ChannelType,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed, buildUserErrorEmbed } from '../../utils/embeds.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildConfig, setConfigValue } from '../../services/guildConfig.js';
import ConfigService from '../../services/configService.js';
import { logger } from '../../utils/logger.js';
import { botConfig } from '../../config/bot.js';

const DASHBOARD_CUSTOM_ID = 'config_select';
const WIZARD_BUTTON_ID = 'config_wizard';
const activeWizardSessions = new Set();

const DM_DISABLED_HELP = [
    '1. Клацніть правою кнопкою миші на назву цього сервера (на мобільному: натисніть на назву сервера вгорі).',
    '2. Відкрийте **Налаштування конфіденційності**.',
    '3. Увімкніть **Дозволити прямі повідомлення від учасників сервера**.',
    '4. Знову натисніть **Запустити майстер налаштування**.',
].join('\n');

async function notifyWizardStarted(buttonInteraction) {
    await buttonInteraction.followUp({
        embeds: [infoEmbed(
            'Майстер налаштування запущено',
            'Перевірте ваші приватні повідомлення (ОП) — я надіслав вам перше питання там.\n\nДайте відповідь на кожне питання в ОП. Напишіть `skip`, щоб зберегти поточне значення.',
        )],
        flags: MessageFlags.Ephemeral,
    }).catch(() => {});
}

async function notifyWizardDmBlocked(buttonInteraction) {
    await replyUserError(buttonInteraction, {
        type: ErrorTypes.USER_INPUT,
        message: `Я не зміг надіслати вам приватне повідомлення. Увімкніть приватні повідомлення від цього сервера, а потім спробуйте знову.\n\n${DM_DISABLED_HELP}`,
    }).catch(() => {});
}

function formatChannelMention(guild, channelId) {
    if (!channelId) {
        return '`Не встановлено`';
    }
    const channel = guild.channels.cache.get(channelId);
    return channel ? `<#${channelId}>` : `#${channelId}`;
}

function formatRoleMention(guild, roleId) {
    if (!roleId) {
        return '`Не встановлено`';
    }
    const role = guild.roles.cache.get(roleId);
    return role ? `<@&${roleId}>` : `@${roleId}`;
}

function getBotPresenceText() {
    const activity = botConfig.presence?.activities?.[0];
    if (!activity?.name) {
        return '`Не налаштовано`';
    }

    const typeLabels = ['Грає в', 'Стрімить', 'Слухає', 'Дивиться', '', 'Змагається в'];
    const typeLabel = typeLabels[activity.type];
    if (!typeLabel) {
        return activity.name;
    }

    return `${typeLabel} **${activity.name}**`;
}

function getThemeColorLines() {
    const colors = botConfig.embeds.colors;
    return [
        `🎨 Основний \`${colors.primary}\` · Успіх \`${colors.success}\``,
        `⚠️ Попередження \`${colors.warning}\` · Помилка \`${colors.error}\``,
    ].join('\n');
}

function buildDashboardEmbed(config, guild) {
    const setupDone = config.setupWizardCompleted;

    return createEmbed({
        title: '⚙️ Конфігурація сервера',
        description: `Основні налаштування для **${guild.name}**. Оберіть опцію нижче або запустіть майстер налаштування.`,
        color: 'info',
        fields: [
            {
                name: '⌨️ Префікс сервера',
                value: `\`${config.prefix || guild.client.config.bot.prefix || '!'}\``,
                inline: true,
            },
            {
                name: '🛡️ Роль модератора',
                value: formatRoleMention(guild, config.modRole),
                inline: true,
            },
            {
                name: '📋 Канал логів',
                value: formatChannelMention(guild, config.logging?.channels?.audit),
                inline: true,
            },
            {
                name: '💚 Статус бота',
                value: getBotPresenceText(),
                inline: false,
            },
            {
                name: '🎨 Тема вбудованих повідомлень',
                value: `${getThemeColorLines()}\n-# Кольори налаштовуються в конфігурації бота і застосовуються глобально.`,
                inline: false,
            },
            {
                name: '⚡ Доступ до команд',
                value: 'Використовуйте `/commands dashboard` для увімкнення або вимкнення команд та підкоманд.',
                inline: false,
            },
            {
                name: `${setupDone ? '✅' : '📝'} Налаштування`,
                value: setupDone
                    ? 'Майстер налаштування завершено — перезапустіть у будь-який час, щоб оновити конфігурацію.'
                    : 'Запустіть майстер налаштування, щоб швидко налаштувати свій сервер.',
                inline: false,
            },
        ],
        footer: 'Панель керування закриється через 10 хвилин бездіяльності',
    });
}

function buildSettingsSelect(guildId) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`${DASHBOARD_CUSTOM_ID}:${guildId}`)
            .setPlaceholder('⚙️ Оберіть параметр для редагування...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Префікс сервера')
                    .setDescription('Змінити префікс текстових команд')
                    .setValue('prefix')
                    .setEmoji('⌨️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Роль модератора')
                    .setDescription('Роль для команд модерації')
                    .setValue('modRole')
                    .setEmoji('🛡️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Канал логів')
                    .setDescription('Канал для системних повідомлень логів')
                    .setValue('logChannelId')
                    .setEmoji('📋'),
            ),
    );
}

function buildButtonRow(config, guildId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${WIZARD_BUTTON_ID}:${guildId}`)
            .setLabel(config.setupWizardCompleted ? 'Перезапустити майстер налаштування' : 'Запустити майстер налаштування')
            .setEmoji('📝')
            .setStyle(config.setupWizardCompleted ? ButtonStyle.Secondary : ButtonStyle.Success),
    );
}

function extractId(value) {
    if (!value || typeof value !== 'string') return null;

    const channelMention = value.match(/<#!?(\d{17,19})>/);
    if (channelMention) return channelMention[1];

    const roleMention = value.match(/<@&(\d{17,19})>/);
    if (roleMention) return roleMention[1];

    const digits = value.match(/^(\d{17,19})$/);
    if (digits) return digits[1];

    return null;
}

async function askQuestion(dmChannel, userId, prompt, stepNumber, totalSteps) {
    await dmChannel.send({
        embeds: [createEmbed({
            title: `Питання налаштування ${stepNumber}/${totalSteps}`,
            description: prompt,
            color: 'primary',
        })],
    });

    const collected = await dmChannel.awaitMessages({
        filter: (message) => message.author.id === userId && !message.author.bot,
        max: 1,
        time: 180_000,
    }).catch(() => null);

    if (!collected || !collected.size) {
        await dmChannel.send({
            embeds: [buildUserErrorEmbed(ErrorTypes.RATE_LIMIT, 'Ви не відповіли вчасно. Запустіть майстер налаштування знову, коли будете готові.')],
        });
        return null;
    }

    const answer = collected.first().content.trim();
    if (answer.toLowerCase() === 'cancel') {
        await dmChannel.send({
            embeds: [infoEmbed('Налаштування скасовано', 'Майстер налаштування зупинено. Ваші збережені відповіді все ще застосовуються.')],
        });
        return { cancelled: true };
    }

    return { answer };
}

function formatSavedAck(key, value, guild) {
    if (key === 'prefix') {
        return `Префікс сервера збережено як \`${value}\`.`;
    }

    if (key === 'logChannelId') {
        if (value === null) {
            return 'Канал логів очищено.';
        }
        const channel = guild.channels.cache.get(value);
        return `Канал логів збережено як ${channel ?? `<#${value}>`}.`;
    }

    if (key === 'modRole') {
        if (value === null) {
            return 'Роль модератора очищена.';
        }
        const role = guild.roles.cache.get(value);
        return `Роль модератора збережена як ${role ?? `<@&${value}>`}.`;
    }

    return 'Параметр збережено.';
}

async function validateGuildChannelId(guild, channelId) {
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
        throw new Error('Цей канал не знайдено на цьому сервері або він не є текстовим.');
    }
    return channel.id;
}

async function validateGuildRoleId(guild, roleId) {
    const role = guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
        throw new Error('Цю роль не знайдено на цьому сервері.');
    }
    return role.id;
}

async function refreshDashboard(rootInteraction, config, guild) {
    const embed = buildDashboardEmbed(config, guild);
    const components = [buildButtonRow(config, guild.id), buildSettingsSelect(guild.id)];
    await InteractionHelper.safeEditReply(rootInteraction, { embeds: [embed], components }).catch(() => {});
}

async function runSetupWizard(buttonInteraction, config, guild, client, rootInteraction) {
    const user = buttonInteraction.user;

    if (activeWizardSessions.has(user.id)) {
        await buttonInteraction.followUp({
            embeds: [warningEmbed('Налаштування вже запущено', 'У вас вже запущено майстер налаштування у приватних повідомленнях. Дайте відповідь там, або напишіть `cancel`, щоб зупинити його.')],
            flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return;
    }

    activeWizardSessions.add(user.id);

    let dmChannel;

    try {
        dmChannel = await user.createDM();
    } catch (error) {
        logger.warn('Failed to create DM channel for setup wizard', { userId: user.id, error: error.message });
        await notifyWizardDmBlocked(buttonInteraction);
        return;
    } finally {
        if (!dmChannel) {
            activeWizardSessions.delete(user.id);
        }
    }

    const prompts = [
        {
            key: 'prefix',
            skipMessage: 'Зберігаємо поточний префікс сервера.',
            question: 'Який префікс команд повинен використовувати цей сервер?\nПоточний: `' + (config.prefix || guild.client.config.bot.prefix || '!') + '`\nНапишіть `skip`, щоб залишити його, або `cancel`, щоб зупинити.',
            parse: async (answer) => {
                const normalized = answer.trim();
                if (normalized.toLowerCase() === 'skip') return undefined;
                if (/\s/.test(normalized) || normalized.length < 1 || normalized.length > 10) {
                    throw new Error('Префікс має бути довжиною від 1 до 10 символів без пробілів.');
                }
                return normalized;
            },
        },
        {
            key: 'logChannelId',
            skipMessage: 'Зберігаємо поточний канал логів.',
            question: 'Який канал має отримувати логи бота?\nНадішліть згадку каналу, ID каналу, `none` для очищення, `skip` для збереження поточного значення або `cancel` для скасування.',
            parse: async (answer) => {
                const normalized = answer.trim();
                if (normalized.toLowerCase() === 'skip') return undefined;
                if (normalized.toLowerCase() === 'none') return null;
                const id = extractId(normalized);
                if (!id) throw new Error('Вкажіть дійсну згадку каналу або ID з цього сервера.');
                return validateGuildChannelId(guild, id);
            },
        },
        {
            key: 'modRole',
            skipMessage: 'Зберігаємо поточну роль модератора.',
            question: 'Яку роль повинні мати модератори?\nНадішліть згадку ролі, ID ролі, `none` для очищення, `skip` для збереження поточного значення або `cancel` для скасування.',
            parse: async (answer) => {
                const normalized = answer.trim();
                if (normalized.toLowerCase() === 'skip') return undefined;
                if (normalized.toLowerCase() === 'none') return null;
                const id = extractId(normalized);
                if (!id) throw new Error('Вкажіть дійсну згадку ролі або ID з цього сервера.');
                return validateGuildRoleId(guild, id);
            },
        },
    ];

    const changes = {};
    const errors = [];
    let wizardCancelled = false;

    try {
        try {
            await dmChannel.send({
                embeds: [createEmbed({
                    title: '📝 Майстер налаштування',
                    description: 'Дайте відповідь на кожне питання в цих приватних повідомленнях.\n\n• Напишіть `skip`, щоб зберегти поточне значення\n• Напишіть `cancel`, щоб зупинити майстер',
                    color: 'info',
                })],
            });
        } catch (error) {
            logger.warn('Failed to send setup wizard DM', { userId: user.id, error: error.message });
            await notifyWizardDmBlocked(buttonInteraction);
            return;
        }

        await notifyWizardStarted(buttonInteraction);

        for (let index = 0; index < prompts.length; index++) {
            const prompt = prompts[index];
            let answered = false;

            while (!answered) {
                const result = await askQuestion(
                    dmChannel,
                    user.id,
                    prompt.question,
                    index + 1,
                    prompts.length,
                );

                if (result === null) {
                    wizardCancelled = true;
                    answered = true;
                    break;
                }

                if (result.cancelled) {
                    wizardCancelled = true;
                    answered = true;
                    break;
                }

                try {
                    const value = await prompt.parse(result.answer);

                    if (value === undefined) {
                        await dmChannel.send({
                            embeds: [infoEmbed('Пропущено', prompt.skipMessage)],
                        });
                    } else {
                        await ConfigService.updateSetting(client, guild.id, prompt.key, value, user.id);
                        changes[prompt.key] = value;
                        await dmChannel.send({
                            embeds: [successEmbed('Збережено', formatSavedAck(prompt.key, value, guild))],
                        });

                        try {
                            const updatedConfig = await getGuildConfig(client, guild.id);
                            await refreshDashboard(rootInteraction, updatedConfig, guild);
                        } catch (refreshError) {
                            logger.debug('Failed to refresh dashboard during setup wizard', { error: refreshError.message });
                        }
                    }

                    answered = true;
                } catch (error) {
                    errors.push(`• ${prompt.key}: ${error.message}`);
                    await dmChannel.send({
                        embeds: [buildUserErrorEmbed(ErrorTypes.VALIDATION, `${error.message}\n\nБудь ласка, дайте відповідь ще раз, напишіть \`skip\` або \`cancel\`.`)],
                    });
                }
            }

            if (wizardCancelled) {
                break;
            }
        }

        if (!wizardCancelled) {
            try {
                await setConfigValue(client, guild.id, 'setupWizardCompleted', true);
            } catch (error) {
                logger.warn('Failed to persist setupWizardCompleted flag', { guildId: guild.id, error: error.message });
            }
        }

        const summaryTitle = wizardCancelled
            ? (Object.keys(changes).length > 0 ? 'Налаштування зупинено' : 'Налаштування скасовано')
            : 'Налаштування завершено';

        const summaryBody = wizardCancelled
            ? (Object.keys(changes).length > 0
                ? `Налаштування зупинено раніше. Збережено **${Object.keys(changes).length}** параметрів.`
                : 'Майстер налаштування зупинено до збереження змін.')
            : (Object.keys(changes).length > 0
                ? `Оновлено **${Object.keys(changes).length}** параметрів.${errors.length > 0 ? ' Деякі відповіді вимагали повторного введення.' : ''}`
                : 'Жодних змін не було застосовано.');

        const summaryEmbed = createEmbed({
            title: wizardCancelled ? `⚠️ ${summaryTitle}` : `✅ ${summaryTitle}`,
            description: summaryBody,
            color: wizardCancelled ? 'warning' : (errors.length > 0 ? 'warning' : 'success'),
        });

        if (errors.length > 0) {
            const uniqueErrors = [...new Set(errors)];
            summaryEmbed.addFields({ name: 'Проблеми', value: uniqueErrors.join('\n').slice(0, 1024) });
        }

        await dmChannel.send({ embeds: [summaryEmbed] });

        try {
            const updatedConfig = await getGuildConfig(client, guild.id);
            await refreshDashboard(rootInteraction, updatedConfig, guild);
        } catch (error) {
            logger.debug('Failed to refresh dashboard after wizard completion', { error: error.message });
        }
    } finally {
        activeWizardSessions.delete(user.id);
    }
}

async function showSettingModal(selectInteraction, guildId, setting) {
    const modalCustomId = `config_wizard_modal:${setting}:${guildId}`;

    if (setting === 'logChannelId') {
        const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle('📋 Оновити канал логів');

        const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId('log_channel')
            .setPlaceholder('Оберіть текстовий канал...')
            .setMinValues(1)
            .setMaxValues(1)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true);

        const channelLabel = new LabelBuilder()
            .setLabel('Канал логів')
            .setDescription('Канал, куди надсилатимуться системні повідомлення логів')
            .setChannelSelectMenuComponent(channelSelect);

        modal.addLabelComponents(channelLabel);
        await selectInteraction.showModal(modal);
        return;
    }

    if (setting === 'modRole') {
        const modal = new ModalBuilder()
            .setCustomId(modalCustomId)
            .setTitle('🛡️ Оновити роль модератора');

        const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId('mod_role')
            .setPlaceholder('Оберіть роль модератора...')
            .setMinValues(1)
            .setMaxValues(1)
            .setRequired(true);

        const roleLabel = new LabelBuilder()
            .setLabel('Роль модератора')
            .setDescription('Роль, яка використовується для команд модерації')
            .setRoleSelectMenuComponent(roleSelect);

        modal.addLabelComponents(roleLabel);
        await selectInteraction.showModal(modal);
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(modalCustomId)
        .setTitle('Оновити префікс сервера');

    const textInput = new TextInputBuilder()
        .setCustomId('value')
        .setLabel('Новий префікс (1-10 символів, без пробілів)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    await selectInteraction.showModal(modal);
}

function resolveSettingModalValue(setting, submitted) {
    if (setting === 'logChannelId') {
        const channelId = submitted.fields.getField('log_channel')?.values?.[0];
        if (!channelId) {
            throw new Error('Будь ласка, оберіть канал логів.');
        }
        return channelId;
    }

    if (setting === 'modRole') {
        const roleId = submitted.fields.getField('mod_role')?.values?.[0];
        if (!roleId) {
            throw new Error('Будь ласка, оберіть роль модератора.');
        }
        return roleId;
    }

    const prefix = submitted.fields.getTextInputValue('value')?.trim();
    if (!prefix || prefix.length < 1 || prefix.length > 10 || /\s/.test(prefix)) {
        throw new Error('Префікс має бути довжиною від 1 до 10 символів без пробілів.');
    }
    return prefix;
}

function buildSettingSuccessMessage(setting, value, guild) {
    if (setting === 'logChannelId') {
        const channel = guild.channels.cache.get(value);
        return `Канал логів встановлено на ${channel ?? `<#${value}>`}.`;
    }

    if (setting === 'modRole') {
        const role = guild.roles.cache.get(value);
        return `Роль модератора встановлено на ${role ?? `<@&${value}>`}.`;
    }

    return `Префікс сервера встановлено на \`${value}\`.`;
}

async function handleSettingModalSubmit(selectInteraction, rootInteraction, setting, guildId, client) {
    const modalCustomId = `config_wizard_modal:${setting}:${guildId}`;

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: (modalInteraction) =>
                modalInteraction.customId === modalCustomId &&
                modalInteraction.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) {
        return;
    }

    try {
        const value = resolveSettingModalValue(setting, submitted);
        await ConfigService.updateSetting(client, guildId, setting, value, submitted.user.id);

        await submitted.reply({
            embeds: [successEmbed('Конфігурацію оновлено', buildSettingSuccessMessage(setting, value, submitted.guild))],
            flags: MessageFlags.Ephemeral,
        });

        const updatedConfig = await getGuildConfig(client, guildId);
        await refreshDashboard(rootInteraction, updatedConfig, submitted.guild);
    } catch (error) {
        logger.error('Config wizard modal submit error:', error);
        await replyUserError(submitted, {
            type: ErrorTypes.CONFIGURATION,
            message: error.message || 'Будь ласка, спробуйте ще раз.',
        }).catch(() => {});
    }
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('configwizard')
        .setDescription('Відкрити панель керування конфігурацією та майстер налаштування')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    category: 'Core',

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) {
                return;
            }

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return replyUserError(interaction, {
                    type: ErrorTypes.PERMISSION,
                    message: 'Вам потрібні права на **Керування сервером**, щоб використовувати цю команду.',
                });
            }

            const guildConfig = await getGuildConfig(interaction.client, interaction.guildId);
            const embed = buildDashboardEmbed(guildConfig, interaction.guild);
            const components = [buildButtonRow(guildConfig, interaction.guildId), buildSettingsSelect(interaction.guildId)];

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed], components });

            const replyMessage = await interaction.fetchReply().catch(() => null);
            if (!replyMessage) {
                return;
            }

            const collectorFilter = (componentInteraction) =>
                componentInteraction.user.id === interaction.user.id &&
                componentInteraction.customId.includes(`:${interaction.guildId}`);

            const componentCollector = replyMessage.createMessageComponentCollector({
                filter: collectorFilter,
                time: 600_000,
            });

            componentCollector.on('collect', async (componentInteraction) => {
                try {
                    if (componentInteraction.isButton()) {
                        await componentInteraction.deferUpdate();

                        if (componentInteraction.customId.startsWith(`${WIZARD_BUTTON_ID}:`)) {
                            const latestConfig = await getGuildConfig(interaction.client, interaction.guildId);
                            await runSetupWizard(componentInteraction, latestConfig, interaction.guild, interaction.client, interaction);
                        }
                        return;
                    }

                    if (componentInteraction.isStringSelectMenu()) {
                        const selected = componentInteraction.values[0];
                        await showSettingModal(componentInteraction, interaction.guildId, selected);
                        await handleSettingModalSubmit(
                            componentInteraction,
                            interaction,
                            selected,
                            interaction.guildId,
                            interaction.client,
                        );
                    }
                } catch (error) {
                    logger.error('Config dashboard interaction error:', error);
                    await replyUserError(componentInteraction, {
                        type: ErrorTypes.UNKNOWN,
                        message: 'Не вдалося обробити ваш вибір. Будь ласка, спробуйте ще раз.',
                    }).catch(() => {});
                }
            });
        } catch (error) {
            logger.error('Config command error:', error);
            await replyUserError(interaction, {
                type: ErrorTypes.CONFIGURATION,
                message: 'Не вдалося відкрити панель конфігурації. Будь ласка, спробуйте ще раз.',
            });
        }
    },
};

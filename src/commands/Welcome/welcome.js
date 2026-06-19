import { getColor } from '../../config/bot.js';
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
} from 'discord.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../utils/database.js';
import { formatWelcomeMessage } from '../../utils/welcome.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_MESSAGE_LENGTH = 1800;

const VARIABLES_HELP =
    '`{user}` — згадка, `{username}` — ім\'я, `{server}` — назва сервера, `{memberCount}` — кількість учасників';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reply with a user-facing error embed and log it.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} message
 */
async function replyError(interaction, message) {
    const embed = new EmbedBuilder()
        .setColor(getColor('error'))
        .setTitle('Помилка')
        .setDescription(message);

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
}

/**
 * Validate an image URL — must be a valid URL with an allowed image extension.
 * @param {string} url
 * @returns {{ valid: boolean; reason?: string }}
 */
function validateImageUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return { valid: false, reason: 'URL-адреса зображення недійсна. Має починатися з `http://` або `https://`.' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: 'URL-адреса має починатися з `http://` або `https://`.' };
    }

    const pathname = parsed.pathname.toLowerCase();
    const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext));
    if (!hasValidExtension) {
        return {
            valid: false,
            reason: `Зображення має мати одне з допустимих розширень: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}.`,
        };
    }

    return { valid: true };
}

// ─── Command definition ───────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Налаштувати систему привітань')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        // /welcome setup
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Налаштувати повідомлення привітання вперше')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Канал для надсилання повідомлень привітання')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('message')
                        .setDescription(`Текст привітання. Змінні: ${VARIABLES_HELP}`)
                        .setMaxLength(MAX_MESSAGE_LENGTH)
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('image')
                        .setDescription('URL зображення для повідомлення привітання (jpg/png/gif/webp)')
                        .setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('ping')
                        .setDescription('Чи згадувати користувача у повідомленні привітання')
                        .setRequired(false)))

        // /welcome config
        .addSubcommand(sub =>
            sub
                .setName('config')
                .setDescription('Змінити поточні налаштування привітань')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Новий канал для привітань')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('message')
                        .setDescription(`Новий текст привітання. Змінні: ${VARIABLES_HELP}`)
                        .setMaxLength(MAX_MESSAGE_LENGTH)
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('image')
                        .setDescription('Новий URL зображення (або "remove" щоб прибрати)')
                        .setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('ping')
                        .setDescription('Чи згадувати користувача')
                        .setRequired(false)))

        // /welcome status
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('Переглянути поточні налаштування привітань'))

        // /welcome disable
        .addSubcommand(sub =>
            sub
                .setName('disable')
                .setDescription('Вимкнути систему привітань')),

    // ─── Handler ──────────────────────────────────────────────────────────────

    async execute(interaction) {
        // Permission check before deferring — avoids unnecessary API call
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: 'Вам потрібні права на **Керування сервером**, щоб використовувати `/welcome`.',
                ephemeral: true,
            });
        }

        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) {
            logger.warn('[Welcome] Failed to defer interaction', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
            });
            return;
        }

        const { options, guild, client } = interaction;
        const subcommand = options.getSubcommand();

        const logCtx = { user: interaction.user.tag, guild: guild.name, guildId: guild.id };

        try {
            switch (subcommand) {
                case 'setup':   return await handleSetup(interaction, { options, guild, client, logCtx });
                case 'config':  return await handleConfig(interaction, { options, guild, client, logCtx });
                case 'status':  return await handleStatus(interaction, { guild, client, logCtx });
                case 'disable': return await handleDisable(interaction, { guild, client, logCtx });
            }
        } catch (error) {
            logger.error(`[Welcome] Unhandled error in /${subcommand}`, { ...logCtx, error: error.message });
            await replyError(interaction, 'Сталася неочікувана помилка. Будь ласка, спробуйте ще раз.');
        }
    },
};

// ─── Subcommand handlers ──────────────────────────────────────────────────────

async function handleSetup(interaction, { options, guild, client, logCtx }) {
    const existingConfig = await getWelcomeConfig(client, guild.id);
    if (existingConfig?.channelId) {
        logger.info(`[Welcome] Setup blocked — config already exists`, logCtx);
        return replyError(
            interaction,
            `Привітання вже налаштовано для <#${existingConfig.channelId}>.\nВикористовуйте **/welcome config**, щоб змінити налаштування, або **/welcome disable**, щоб скинути їх.`,
        );
    }

    const channel = options.getChannel('channel');
    const message = options.getString('message').trim();
    const image   = options.getString('image') ?? null;
    const ping    = options.getBoolean('ping') ?? false;

    if (!message) {
        return replyError(interaction, 'Повідомлення привітання не може бути порожнім.');
    }

    if (image) {
        const { valid, reason } = validateImageUrl(image);
        if (!valid) return replyError(interaction, reason);
    }

    await updateWelcomeConfig(client, guild.id, {
        enabled: true,
        channelId: channel.id,
        welcomeMessage: message,
        welcomeImage: image ?? undefined,
        welcomePing: ping,
    });

    logger.info('[Welcome] Setup complete', logCtx);

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [buildSuccessEmbed({
            title: '✅ Система привітань налаштована',
            description: `Повідомлення привітання надсилатимуться до ${channel}.`,
            message,
            image,
            ping,
            guild,
            user: interaction.user,
            footer: 'Підказка: /welcome config — змінити · /welcome disable — вимкнути',
        })],
    });
}

async function handleConfig(interaction, { options, guild, client, logCtx }) {
    const existingConfig = await getWelcomeConfig(client, guild.id);
    if (!existingConfig?.channelId) {
        return replyError(
            interaction,
            'Систему привітань ще не налаштовано. Спочатку виконайте **/welcome setup**.',
        );
    }

    const channel    = options.getChannel('channel')  ?? null;
    const message    = options.getString('message')?.trim() ?? null;
    const imageInput = options.getString('image')     ?? null;
    const ping       = options.getBoolean('ping')     ?? null;

    if (!channel && !message && imageInput === null && ping === null) {
        return replyError(interaction, 'Вкажіть хоча б один параметр для зміни.');
    }

    // "remove" is a sentinel value to clear the image
    let newImage = existingConfig.welcomeImage ?? null;
    if (imageInput !== null) {
        if (imageInput.toLowerCase() === 'remove') {
            newImage = null;
        } else {
            const { valid, reason } = validateImageUrl(imageInput);
            if (!valid) return replyError(interaction, reason);
            newImage = imageInput;
        }
    }

    const updatedConfig = {
        enabled:        existingConfig.enabled ?? true,
        channelId:      channel?.id  ?? existingConfig.channelId,
        welcomeMessage: message      ?? existingConfig.welcomeMessage,
        welcomeImage:   newImage     ?? undefined,
        welcomePing:    ping         ?? existingConfig.welcomePing ?? false,
    };

    await updateWelcomeConfig(client, guild.id, updatedConfig);
    logger.info('[Welcome] Config updated', logCtx);

    const resolvedChannel = channel ?? { toString: () => `<#${updatedConfig.channelId}>` };

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [buildSuccessEmbed({
            title: '✅ Налаштування привітань оновлено',
            description: `Зміни збережено. Повідомлення надсилатимуться до ${resolvedChannel}.`,
            message: updatedConfig.welcomeMessage,
            image: newImage,
            ping: updatedConfig.welcomePing,
            guild,
            user: interaction.user,
            footer: 'Підказка: /welcome status — переглянути · /welcome disable — вимкнути',
        })],
    });
}

async function handleStatus(interaction, { guild, client, logCtx }) {
    const config = await getWelcomeConfig(client, guild.id);

    if (!config?.channelId) {
        logger.info('[Welcome] Status: not configured', logCtx);
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [new EmbedBuilder()
                .setColor(getColor('warning'))
                .setTitle('Система привітань')
                .setDescription('Систему привітань ще не налаштовано. Виконайте **/welcome setup**, щоб почати.')],
        });
    }

    const preview = formatWelcomeMessage(config.welcomeMessage, {
        user: interaction.user,
        guild,
    });

    const embed = new EmbedBuilder()
        .setColor(config.enabled ? getColor('success') : getColor('warning'))
        .setTitle('Система привітань — поточні налаштування')
        .addFields(
            { name: 'Статус',                  value: config.enabled ? '✅ Увімкнено' : '❌ Вимкнено',       inline: true },
            { name: 'Канал',                   value: `<#${config.channelId}>`,                              inline: true },
            { name: 'Згадувати користувача',   value: config.welcomePing ? 'Так' : 'Ні',                     inline: true },
            { name: 'Попередній перегляд',     value: preview },
        )
        .setFooter({ text: '/welcome config — змінити · /welcome disable — вимкнути' });

    if (config.welcomeImage) embed.setImage(config.welcomeImage);

    logger.info('[Welcome] Status viewed', logCtx);
    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
}

async function handleDisable(interaction, { guild, client, logCtx }) {
    const config = await getWelcomeConfig(client, guild.id);

    if (!config?.channelId) {
        return replyError(interaction, 'Систему привітань ще не налаштовано.');
    }

    await updateWelcomeConfig(client, guild.id, {
        ...config,
        enabled: false,
        channelId: null,
    });

    logger.info('[Welcome] Disabled', logCtx);

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [new EmbedBuilder()
            .setColor(getColor('error'))
            .setTitle('❌ Систему привітань вимкнено')
            .setDescription('Повідомлення привітання більше не надсилатимуться.\nЩоб увімкнути знову, виконайте **/welcome setup**.')],
    });
}

// ─── Embed builder ────────────────────────────────────────────────────────────

function buildSuccessEmbed({ title, description, message, image, ping, guild, user, footer }) {
    const preview = formatWelcomeMessage(message, { user, guild });

    const embed = new EmbedBuilder()
        .setColor(getColor('success'))
        .setTitle(title)
        .setDescription(description)
        .addFields(
            { name: 'Попередній перегляд',   value: preview },
            { name: 'Згадувати користувача', value: ping ? 'Так' : 'Ні', inline: true },
            { name: 'Статус',                value: '✅ Увімкнено',       inline: true },
        )
        .setFooter({ text: footer });

    if (image) embed.setImage(image);

    return embed;
}

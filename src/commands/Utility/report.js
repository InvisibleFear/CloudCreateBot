import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import report from './modules/report.js';
import reportSetchannel from './modules/report_setchannel.js';

export default {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Повідомити про порушника адміністрації або налаштувати канал для скарг.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('file')
                .setDescription('Подати скаргу на користувача команді модерації сервера.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Користувач, на якого ви скаржитесь.')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Причина скарги (будьте детальні).')
                        .setRequired(true)
                        .setMaxLength(500),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Встановити канал, куди надсилатимуться скарги. (Потрібне Керування сервером)')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Текстовий канал для отримання скарг.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                ),
        ),
    category: 'Utility',

    async execute(interaction, config, client) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'file') {
                return await report.execute(interaction, config, client);
            }

            if (subcommand === 'setchannel') {
                return await reportSetchannel.execute(interaction, config, client);
            }

            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Невідома підкоманда.' });
        } catch (error) {
            logger.error('report command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'report', source: 'report_command' });
        }
    },
};
import { PermissionsBitField } from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { setLogChannel } from '../../../services/loggingService.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Вам потрібні права на **Керування сервером**, щоб налаштувати канал для скарг.' });
        }

        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guildId;

        try {
            await setLogChannel(client, guildId, 'reports', channel.id);

            return InteractionHelper.safeReply(interaction, {
                embeds: [successEmbed(
                    `Усі нові скарги тепер надсилатимуться до ${channel}.\nВи також можете керувати цим за допомогою \`/logging dashboard\`.`,
                    'Канал для скарг встановлено',
                )],
                ephemeral: true,
            });
        } catch (error) {
            logger.error('report_setchannel error:', error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Не вдалося зберегти конфігурацію каналу.' });
        }
    },
};

import { createEmbed } from '../../../utils/embeds.js';
import { getGuildConfig } from '../../../services/guildConfig.js';
import { logEvent, EVENT_TYPES, resolveLogChannel } from '../../../services/loggingService.js';
import { formatLogLine, resolveUserAuthor } from '../../../utils/logEmbeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
        if (!deferSuccess) {
            logger.warn('Report interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const guildId = interaction.guildId;

        const guildConfig = await getGuildConfig(client, guildId);
        const reportChannelId = resolveLogChannel(guildConfig, 'reports');

        if (!reportChannelId) {
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Канал для скарг не налаштовано. Попросіть модератора скористатися `/logging dashboard` або `/logging channel`.' });
        }

        try {
            const ownerMention = interaction.guild.ownerId
                ? `<@${interaction.guild.ownerId}> Нова скарга!`
                : 'Нова скарга!';

            await logEvent({
                client,
                guildId,
                eventType: EVENT_TYPES.REPORT_FILE,
                content: ownerMention,
                data: {
                    title: 'Скарга на користувача',
                    lines: [
                        formatLogLine('Порушник', `${targetUser.tag} (\`${targetUser.id}\`)`),
                        formatLogLine('Автор скарги', `${interaction.user.tag} (\`${interaction.user.id}\`)`),
                        formatLogLine('Канал', interaction.channel.toString()),
                    ],
                    blockFields: [{ name: 'Причина', value: reason }],
                    author: await resolveUserAuthor(client, targetUser.id),
                    thumbnail: targetUser.displayAvatarURL(),
                },
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [createEmbed({
                    title: 'Скаргу надіслано',
                    description: `Вашу скаргу на **${targetUser.tag}** успішно зареєстровано та надіслано команді модерації. Дякуємо!`,
                })],
            });

            logger.info('Report submitted', {
                userId: interaction.user.id,
                reportedUserId: targetUser.id,
                guildId,
                reasonLength: reason.length,
            });
        } catch (error) {
            logger.error('report error:', error);
            await handleInteractionError(interaction, error, { commandName: 'report', source: 'report' });
        }
    },
};

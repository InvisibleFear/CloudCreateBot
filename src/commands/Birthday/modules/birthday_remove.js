import { EmbedBuilder } from 'discord.js';
import { deleteBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            const result = await deleteBirthday(client, guildId, userId);

            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('День народження видалено')
                    .setDescription('Ваш день народження успішно видалено з сервера.');
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                });
            } else if (result.notFound) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('День народження не знайдено')
                    .setDescription('У вас не встановлено день народження, який можна видалити.');
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                });
            }
        } catch (error) {
            logger.error("Помилка виконання birthday remove", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday_remove'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_remove',
                source: 'birthday_remove_module'
            });
        }
    }
};
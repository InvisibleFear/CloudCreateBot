import { EmbedBuilder } from 'discord.js';
import { getUserBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const targetUser = interaction.options.getUser("user") || interaction.user;
            const userId = targetUser.id;
            const guildId = interaction.guildId;

            const birthdayData = await getUserBirthday(client, guildId, userId);

            if (!birthdayData) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('День народження не знайдено')
                    .setDescription(targetUser.id === interaction.user.id 
                        ? "Ви ще не вказали свій день народження. Використайте `/birthday set`, щоб додати його!"
                        : `${targetUser.username} ще не вказав(ла) свій день народження.`);
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                });
            }
            
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎂 Інформація про день народження')
                .setDescription(`**Дата:** ${birthdayData.monthName} ${birthdayData.day}\n**Користувач:** ${targetUser.toString()}`);
            
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
            
            logger.info('Інформацію про день народження успішно отримано', {
                userId: interaction.user.id,
                targetUserId: targetUser.id,
                guildId,
                commandName: 'birthday_info'
            });
        } catch (error) {
            logger.error("Помилка виконання birthday info", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday_info'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_info',
                source: 'birthday_info_module'
            });
        }
    }
};
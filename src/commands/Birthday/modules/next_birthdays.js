import { EmbedBuilder } from 'discord.js';
import { getUpcomingBirthdays } from '../../../services/birthdayService.js';
import { deleteBirthday } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const next5 = await getUpcomingBirthdays(client, interaction.guildId, 5);

            if (next5.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Днів народження не знайдено')
                    .setDescription('На цьому сервері ще не додано жодного дня народження. Використайте `/birthday set`, щоб додати свій!');
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                });
            }

            let displayIndex = 0;
            for (const birthday of next5) {
                const member = await interaction.guild.members.fetch(birthday.userId).catch(() => null);
                if (!member) {
                    deleteBirthday(client, interaction.guildId, birthday.userId).catch(() => null);
                    continue;
                }
                displayIndex++;

                let timeUntil = '';
                if (birthday.daysUntil === 0) {
                    timeUntil = '🎉 **Сьогодні!**';
                } else if (birthday.daysUntil === 1) {
                    timeUntil = '📅 **Завтра!**';
                } else {
                    timeUntil = `Через ${birthday.daysUntil} ${birthday.daysUntil === 1 ? 'день' : birthday.daysUntil < 5 ? 'дні' : 'днів'}`;
                }
            }

            if (displayIndex === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Найближчих днів народження немає')
                    .setDescription('Для поточних учасників сервера найближчих днів народження не знайдено.');
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                });
            }

            let birthdayList = `🎂 **Наступні 5 днів народження**\n\nОсь найближчі дні народження на ${interaction.guild.name}:\n\n`;
            displayIndex = 0;
            for (const birthday of next5) {
                const member = await interaction.guild.members.fetch(birthday.userId).catch(() => null);
                if (!member) {
                    continue;
                }
                displayIndex++;

                let timeUntil = '';
                if (birthday.daysUntil === 0) {
                    timeUntil = '🎉 **Сьогодні!**';
                } else if (birthday.daysUntil === 1) {
                    timeUntil = '📅 **Завтра!**';
                } else {
                    timeUntil = `Через ${birthday.daysUntil} ${birthday.daysUntil === 1 ? 'день' : birthday.daysUntil < 5 ? 'дні' : 'днів'}`;
                }

                birthdayList += `${displayIndex}. **${member.displayName}**\n<@${birthday.userId}>\n📅 **Дата:** ${birthday.monthName} ${birthday.day}\n⏰ **Коли:** ${timeUntil}\n\n`;
            }

            birthdayList += `Використайте /birthday set, щоб додати свій день народження!`;

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎂 Наступні 5 днів народження')
                .setDescription(birthdayList);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
            
            logger.info('Найближчі дні народження успішно отримано', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                upcomingCount: displayIndex,
                commandName: 'next_birthdays'
            });
        } catch (error) {
            logger.error('Помилка виконання next_birthdays', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'next_birthdays'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'next_birthdays',
                source: 'next_birthdays_module'
            });
        }
    }
};
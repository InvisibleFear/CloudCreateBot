import { EmbedBuilder } from 'discord.js';
import { getAllBirthdays } from '../../../services/birthdayService.js';
import { deleteBirthday } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const guildId = interaction.guildId;

            const sortedBirthdays = await getAllBirthdays(client, guildId);

            if (sortedBirthdays.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Немає днів народження')
                    .setDescription('На цьому сервері ще не додано жодного дня народження.');
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                });
            }

            const userIds = sortedBirthdays.map(b => b.userId);
            const fetchedMembers = await interaction.guild.members.fetch({ user: userIds }).catch(() => null);

            let birthdayList = '';
            let displayIndex = 0;
            const staleUserIds = [];

            for (const birthday of sortedBirthdays) {
                if (fetchedMembers && !fetchedMembers.has(birthday.userId)) {
                    staleUserIds.push(birthday.userId);
                    continue;
                }
                displayIndex++;
                birthdayList += `${displayIndex}. <@${birthday.userId}> — ${birthday.monthName} ${birthday.day}\n`;
            }

            if (fetchedMembers && staleUserIds.length > 0) {
                for (const userId of staleUserIds) {
                    deleteBirthday(client, guildId, userId).catch(() => null);
                }
            }

            if (displayIndex === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Немає днів народження')
                    .setDescription('Жоден поточний учасник сервера не вказав день народження.');
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed]
                });
            }

            birthdayList = `**${displayIndex} ${displayIndex === 1 ? 'день народження' : 'днів народження'} на ${interaction.guild.name}**\n\n` + birthdayList;

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎂 Дні народження сервера')
                .setDescription(`${birthdayList}\n\nВсього: ${displayIndex} ${displayIndex === 1 ? 'день народження' : 'днів народження'}`);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
            
            logger.info('Список днів народження успішно отримано', {
                userId: interaction.user.id,
                guildId,
                birthdayCount: displayIndex,
                staleRemoved: staleUserIds.length,
                commandName: 'birthday_list'
            });
        } catch (error) {
            logger.error("Помилка виконання birthday list", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday_list'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_list',
                source: 'birthday_list_module'
            });
        }
    }
};
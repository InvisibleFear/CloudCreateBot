import { SlashCommandBuilder, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import birthdaySet from './modules/birthday_set.js';
import birthdayInfo from './modules/birthday_info.js';
import birthdayList from './modules/birthday_list.js';
import birthdayRemove from './modules/birthday_remove.js';
import nextBirthdays from './modules/next_birthdays.js';
import birthdaySetchannel from './modules/birthday_setchannel.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Команди системи днів народження')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Встановити дату свого дня народження')
                .addIntegerOption(option =>
                    option
                        .setName('month')
                        .setDescription('Місяць народження (1-12)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(12)
                )
                .addIntegerOption(option =>
                    option
                        .setName('day')
                        .setDescription('День народження (1-31)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(31)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Переглянути інформацію про день народження')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Користувач, чий день народження переглядається')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Список усіх днів народження на сервері')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Видалити свій день народження')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('next')
                .setDescription('Показати найближчі дні народження')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Встановити або вимкнути канал для оголошень днів народження. (Потрібне право Керувати сервером)')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Текстовий канал для оголошень. Залиште порожнім, щоб вимкнути.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        ),

    async execute(interaction, config, client) {
        try {
            const subcommand = interaction.options.getSubcommand();
            
            switch (subcommand) {
                case 'set':
                    return await birthdaySet.execute(interaction, config, client);
                case 'info':
                    return await birthdayInfo.execute(interaction, config, client);
                case 'list':
                    return await birthdayList.execute(interaction, config, client);
                case 'remove':
                    return await birthdayRemove.execute(interaction, config, client);
                case 'next':
                    return await nextBirthdays.execute(interaction, config, client);
                case 'setchannel':
                    return await birthdaySetchannel.execute(interaction, config, client);
                default:
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Невідома підкоманда' });
            }
        } catch (error) {
            logger.error('Помилка виконання команди birthday', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday',
                subcommand: interaction.options.getSubcommand()
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday',
                source: 'birthday_command'
            });
        }
    }
};
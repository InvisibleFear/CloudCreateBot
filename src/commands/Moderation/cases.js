import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getModerationCases } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName('cases')
        .setDescription('Переглянути справи та журнали модерації')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Фільтрувати справи за типом або користувачем')
                .addChoices(
                    { name: 'Усі справи', value: 'all' },
                    { name: 'Блокування', value: 'Member Banned' },
                    { name: 'Виключення', value: 'Member Kicked' },
                    { name: 'Тайм-аути', value: 'Member Timed Out' },
                    { name: 'Попередження', value: 'User Warned' }
                )
        )
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Фільтрувати справи за конкретним користувачем')
        )
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Кількість справ для показу (за замовчуванням: 10)')
                .setMinValue(1)
                .setMaxValue(50)
        ),

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Помилка відкладення взаємодії cases`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'cases'
            });
            return;
        }

        try {
            const filterType = interaction.options.getString('filter') || 'all';
            const targetUser = interaction.options.getUser('user');
            const limit = interaction.options.getInteger('limit') || 10;

            const filters = {
                limit,
                action: filterType === 'all' ? undefined : filterType,
                userId: targetUser?.id
            };

            const cases = await getModerationCases(interaction.guild.id, filters);

            if (cases.length === 0) {
                throw new Error(targetUser 
                    ? `Справ модерації для ${targetUser.tag} не знайдено`
                    : `Справ ${filterType === 'all' ? '' : filterType} на цьому сервері не знайдено.`
                );
            }

            const CASES_PER_PAGE = 5;
            const totalPages = Math.ceil(cases.length / CASES_PER_PAGE);
            let currentPage = 1;

            const createCasesEmbed = (page) => {
                const startIndex = (page - 1) * CASES_PER_PAGE;
                const endIndex = startIndex + CASES_PER_PAGE;
                const pageCases = cases.slice(startIndex, endIndex);

                const embed = createEmbed({
                    title: '📋 Справи модерації',
                    description: `Справи модерації для **${interaction.guild.name}**\n\n**Сторінка ${page} з ${totalPages}**`
                });

                pageCases.forEach(case_ => {
                    const date = new Date(case_.createdAt).toLocaleDateString('uk-UA');
                    const time = new Date(case_.createdAt).toLocaleTimeString('uk-UA');
                    
                    embed.addFields({
                        name: `Справа #${case_.caseId} — ${case_.action}`,
                        value: `**Ціль:** ${case_.target}\n**Модератор:** ${case_.executor}\n**Дата:** ${date} о ${time}\n**Причина:** ${case_.reason || 'Причина не вказана'}`,
                        inline: false
                    });
                });

                embed.setFooter({
                    text: `Всього справ: ${cases.length} | Фільтр: ${filterType}${targetUser ? ` | Користувач: ${targetUser.tag}` : ''}`
                });

                return embed;
            };

            const createNavigationRow = (page) => {
                const row = new ActionRowBuilder();
                
                const prevButton = new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('⬅️ Назад')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 1);

                const pageInfoButton = new ButtonBuilder()
                    .setCustomId('page_info')
                    .setLabel(`Сторінка ${page}/${totalPages}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true);

                const nextButton = new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Вперед ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages);

                row.addComponents(prevButton, pageInfoButton, nextButton);
                return row;
            };

            const message = await interaction.editReply({ 
                embeds: [createCasesEmbed(currentPage)], 
                components: [createNavigationRow(currentPage)]
            });

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
time: 120000
            });

            collector.on('collect', async (buttonInteraction) => {
                await buttonInteraction.deferUpdate();

                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.followUp({
                        content: 'Ви не можете використовувати ці кнопки. Виконайте `/cases`, щоб отримати власне відображення справ.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const { customId } = buttonInteraction;

                if (customId === 'prev_page' && currentPage > 1) {
                    currentPage--;
                } else if (customId === 'next_page' && currentPage < totalPages) {
                    currentPage++;
                }

                await buttonInteraction.editReply({
                    embeds: [createCasesEmbed(currentPage)],
                    components: [createNavigationRow(currentPage)]
                });
            });

            collector.on('end', async () => {
                const disabledRow = createNavigationRow(currentPage);
                disabledRow.components.forEach(button => button.setDisabled(true));
                
                try {
                    await message.edit({
                        components: [disabledRow]
                    });
                } catch (error) {
                }
            });

        } catch (error) {
            logger.error('Помилка команди cases:', error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Під час отримання справ модерації виникла помилка. Спробуйте ще раз.' });
        }
    }
};
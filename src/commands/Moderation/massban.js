import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderationService.js';
import { CLoudCreateError } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("massban")
        .setDescription("Заблокувати кількох користувачів на сервері одночасно")
        .addStringOption(option =>
            option
                .setName("users")
                .setDescription("ID або згадки користувачів для блокування (розділені пробілами або комами)")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Причина масового блокування")
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName("delete_days")
                .setDescription("Кількість днів повідомлень для видалення (0-7)")
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",
    abuseProtection: { maxAttempts: 3, windowMs: 60_000 },

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Помилка відкладення взаємодії massban`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'massban'
            });
            return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'У вас немає права блокувати учасників.' });
        }

        const usersInput = interaction.options.getString("users");
        const reason = interaction.options.getString("reason") || "Масове блокування — причина не вказана";
        const deleteDays = interaction.options.getInteger("delete_days") || 0;

        try {
            const userIds = usersInput
.replace(/<@!?(\d+)>/g, '$1')
.split(/[\s,]+/)
.filter(id => id && /^\d+$/.test(id))
.slice(0, 20);

            if (userIds.length === 0) {
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Вкажіть дійсні ID або згадки користувачів. Максимум 20 користувачів одночасно.' });
            }

            if (userIds.includes(interaction.user.id)) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ви не можете включити себе до масового блокування.' });
            }

            if (userIds.includes(client.user.id)) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ви не можете включити бота до масового блокування.' });
            }

            const results = {
                successful: [],
                failed: [],
                skipped: []
            };

            for (const userId of userIds) {
                try {
                    const user = await client.users.fetch(userId).catch(() => null);
                    
                    if (!user) {
                        results.failed.push({ userId, reason: "Користувача не знайдено" });
                        continue;
                    }

                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    
                    if (member) {
                        const modCheck = ModerationService.validateHierarchy(interaction.member, member, 'ban');
                        if (!modCheck.valid) {
                            results.skipped.push({
                                user: user.tag,
                                userId,
                                reason: ModerationService.buildHierarchySkipReason(interaction.member, member, 'ban'),
                            });
                            continue;
                        }

                        const botCheck = ModerationService.validateBotHierarchy(member, 'ban');
                        if (!botCheck.valid) {
                            results.skipped.push({
                                user: user.tag,
                                userId,
                                reason: ModerationService.buildHierarchySkipReason(interaction.member, member, 'ban', 'bot'),
                            });
                            continue;
                        }
                    }

                    await interaction.guild.members.ban(userId, {
                        reason: reason,
                        deleteMessageDays: deleteDays
                    });

                    results.successful.push({
                        user: user.tag,
                        userId
                    });

                    await logModerationAction({
                        client,
                        guild: interaction.guild,
                        event: {
                            action: "Учасника заблоковано",
                            target: `${user.tag} (${user.id})`,
                            executor: `${interaction.user.tag} (${interaction.user.id})`,
                            reason: `${reason} (Масове блокування)`,
                            metadata: {
                                userId: user.id,
                                moderatorId: interaction.user.id,
                                massBan: true,
                                permanent: true
                            }
                        }
                    });

                } catch (error) {
                    logger.error(`Не вдалося заблокувати користувача ${userId}:`, error);
                    const reason = error instanceof CLoudCreateError
                        ? (error.userMessage || error.message)
                        : (error.message || "Невідома помилка");
                    results.failed.push({ 
                        userId, 
                        reason,
                    });
                }
            }

            let description = `**Результати масового блокування:**\n\n`;
            
            if (results.successful.length > 0) {
                description += `✅ **Успішно заблоковано (${results.successful.length}):**\n`;
                results.successful.forEach(result => {
                    description += `• ${result.user} (${result.userId})\n`;
                });
                description += '\n';
            }

            if (results.skipped.length > 0) {
                description += `⚠️ **Пропущено (${results.skipped.length}):**\n`;
                results.skipped.forEach(result => {
                    description += `• ${result.user} — ${result.reason}\n`;
                });
                description += '\n';
            }

            if (results.failed.length > 0) {
                description += `❌ **Не вдалося (${results.failed.length}):**\n`;
                results.failed.forEach(result => {
                    description += `• ${result.userId} — ${result.reason}\n`;
                });
            }

            const embed = results.successful.length > 0 ? successEmbed : warningEmbed;
            
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    embed(
                        `🔨 Масове блокування завершено`,
                        description
                    )
                ]
            });

        } catch (error) {
            logger.error("Помилка команди massban:", error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Під час масового блокування виникла помилка. Спробуйте ще раз.' });
        }
    }
};
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderationService.js';
import { CLoudCreateError } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("masskick")
        .setDescription("Виключити кількох користувачів із сервера одночасно")
        .addStringOption(option =>
            option
                .setName("users")
                .setDescription("ID або згадки користувачів для виключення (розділені пробілами або комами)")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Причина масового виключення")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    category: "moderation",
    abuseProtection: { maxAttempts: 3, windowMs: 60_000 },

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Помилка відкладення взаємодії masskick`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'masskick'
            });
            return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'У вас немає права виключати учасників.' });
        }

        const usersInput = interaction.options.getString("users");
        const reason = interaction.options.getString("reason") || "Масове виключення — причина не вказана";

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
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ви не можете включити себе до масового виключення.' });
            }

            if (userIds.includes(client.user.id)) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ви не можете включити бота до масового виключення.' });
            }

            const results = {
                successful: [],
                failed: [],
                skipped: []
            };

            for (const userId of userIds) {
                try {
                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    
                    if (!member) {
                        results.failed.push({ userId, reason: "Користувач не на сервері" });
                        continue;
                    }

                    const modCheck = ModerationService.validateHierarchy(interaction.member, member, 'kick');
                    if (!modCheck.valid) {
                        results.skipped.push({
                            user: member.user.tag,
                            userId,
                            reason: ModerationService.buildHierarchySkipReason(interaction.member, member, 'kick'),
                        });
                        continue;
                    }

                    const botCheck = ModerationService.validateBotHierarchy(member, 'kick');
                    if (!botCheck.valid) {
                        results.skipped.push({
                            user: member.user.tag,
                            userId,
                            reason: ModerationService.buildHierarchySkipReason(interaction.member, member, 'kick', 'bot'),
                        });
                        continue;
                    }

                    if (!member.kickable) {
                        results.skipped.push({
                            user: member.user.tag,
                            userId,
                            reason: 'Ціль має роль адміністратора або керованих роль, або бот не має права виключати',
                        });
                        continue;
                    }

                    await member.kick(reason);

                    results.successful.push({
                        user: member.user.tag,
                        userId
                    });

                    await logModerationAction({
                        client,
                        guild: interaction.guild,
                        event: {
                            action: "Учасника виключено",
                            target: `${member.user.tag} (${member.user.id})`,
                            executor: `${interaction.user.tag} (${interaction.user.id})`,
                            reason: `${reason} (Масове виключення)`,
                            metadata: {
                                userId: member.user.id,
                                moderatorId: interaction.user.id,
                                massKick: true
                            }
                        }
                    });

                } catch (error) {
                    logger.error(`Не вдалося виключити користувача ${userId}:`, error);
                    const reason = error instanceof CLoudCreateError
                        ? (error.userMessage || error.message)
                        : (error.message || "Невідома помилка");
                    results.failed.push({ 
                        userId, 
                        reason,
                    });
                }
            }

            let description = `**Результати масового виключення:**\n\n`;
            
            if (results.successful.length > 0) {
                description += `✅ **Успішно виключено (${results.successful.length}):**\n`;
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
                        `👢 Масове виключення завершено`,
                        description
                    )
                ]
            });

        } catch (error) {
            logger.error("Помилка команди masskick:", error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Під час масового виключення виникла помилка. Спробуйте ще раз.' });
        }
    }
};
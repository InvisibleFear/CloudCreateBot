import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Розблокувати користувача на сервері")
        .addUserOption(option =>
            option
                .setName("target")
                .setDescription("Користувач для розблокування (може бути ID або згадка)")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Причина розблокування")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Помилка відкладення взаємодії unban`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'unban'
            });
            return;
        }

        try {
                const targetUser = interaction.options.getUser("target");
                const reason = interaction.options.getString("reason") || "Причина не вказана";

                const result = await ModerationService.unbanUser({
                    guild: interaction.guild,
                    user: targetUser,
                    moderator: interaction.member,
                    reason
                });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            "✅ Користувача розблоковано",
                            `**${targetUser.tag}** успішно розблоковано на сервері.\n\n**Причина:** ${reason}\n**ID справи:** #${result.caseId}`
                        )
                    ]
                });
        } catch (error) {
            logger.error('Помилка команди unban:', error);
            await handleInteractionError(interaction, error, { subtype: 'unban_failed' });
        }
    }
};
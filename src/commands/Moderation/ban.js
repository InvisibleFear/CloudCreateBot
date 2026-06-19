import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError, CLoudCreateError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Заблокувати користувача на сервері")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("Користувач для блокування")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Причина блокування"),
        )
.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        try {
            const user = interaction.options.getUser("target");
            const reason = interaction.options.getString("reason") || "Причина не вказана";

            if (!user) {
                throw new CLoudCreateError(
                    'Missing target user',
                    ErrorTypes.USER_INPUT,
                    'Ви повинні вказати користувача для блокування.',
                    { subtype: 'invalid_user' },
                );
            }

            if (user.id === interaction.user.id) {
                throw new Error("Ви не можете заблокувати себе.");
            }
            if (user.id === client.user.id) {
                throw new Error("Ви не можете заблокувати бота.");
            }

            const result = await ModerationService.banUser({
                guild: interaction.guild,
                user,
                moderator: interaction.member,
                reason
            });

            await InteractionHelper.universalReply(interaction, {
                embeds: [
                    successEmbed(
                        `🚫 **Заблоковано** ${user.tag}`,
                        `**Причина:** ${reason}\n**ID справи:** #${result.caseId}`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Помилка команди ban:', error);
            await handleInteractionError(interaction, error, { subtype: 'ban_failed' });
        }
    },
};
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError, CLoudCreateError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Зняти тайм-аут з користувача")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("Користувач, з якого знімається тайм-аут")
                .setRequired(true),
        )
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Помилка відкладення взаємодії untimeout`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'untimeout'
            });
            return;
        }

        try {
            const targetUser = interaction.options.getUser("target");
            const member = interaction.options.getMember("target");

            if (!targetUser) {
                throw new CLoudCreateError(
                    'Missing target user',
                    ErrorTypes.USER_INPUT,
                    'Ви повинні вказати користувача для зняття тайм-ауту.',
                    { subtype: 'invalid_user' },
                );
            }

            if (!member) {
                throw new CLoudCreateError(
                    "Target not found",
                    ErrorTypes.USER_INPUT,
                    "Цільовий користувач зараз не знаходиться на цьому сервері."
                );
            }

            await ModerationService.removeTimeoutUser({
                guild: interaction.guild,
                member,
                moderator: interaction.member
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        `🔓 **Тайм-аут знято** з ${targetUser.tag}`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Помилка команди untimeout:', error);
            await handleInteractionError(interaction, error, { subtype: 'untimeout_failed' });
        }
    }
};

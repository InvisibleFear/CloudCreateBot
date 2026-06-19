import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError, CLoudCreateError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Кікнути (вигнати) користувача з сервера")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Користувач, якого потрібно вигнати")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Причина вигнання"),
    )
.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  category: "moderation",

  async execute(interaction, config, client) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        throw new CLoudCreateError(
          "User lacks permission",
          ErrorTypes.PERMISSION,
          "Ви не маєте дозволу на вигнання учасників."
        );
      }

      const targetUser = interaction.options.getUser("target");
      const member = interaction.options.getMember("target");
      const reason = interaction.options.getString("reason") || "Причину не вказано";

      if (!targetUser) {
        throw new CLoudCreateError(
          'Missing target user',
          ErrorTypes.USER_INPUT,
          'Ви повинні вказати користувача, якого потрібно вигнати.',
          { subtype: 'invalid_user' },
        );
      }

      if (targetUser.id === interaction.user.id) {
        throw new CLoudCreateError(
          "Cannot kick self",
          ErrorTypes.VALIDATION,
          "Ви не можете вигнати самого себе."
        );
      }

      if (targetUser.id === client.user.id) {
        throw new CLoudCreateError(
          "Cannot kick bot",
          ErrorTypes.VALIDATION,
          "Ви не можете вигнати бота."
        );
      }

      if (!member) {
        throw new CLoudCreateError(
          "Target not found",
          ErrorTypes.USER_INPUT,
          "Користувача не знайдено на цьому сервері.",
          { subtype: 'user_not_found' }
        );
      }

      const result = await ModerationService.kickUser({
        guild: interaction.guild,
        member,
        moderator: interaction.member,
        reason,
      });

      await InteractionHelper.universalReply(interaction, {
        embeds: [
          successEmbed(
            `**Причина:** ${reason}\n**Номер кейсу:** #${result.caseId}`,
            `👢 Вигнано користувача ${targetUser.tag}`,
          ),
        ],
      });
    } catch (error) {
      logger.error('Kick command error:', error);
      await handleInteractionError(interaction, error, { subtype: 'kick_failed' });
    }
  }
};

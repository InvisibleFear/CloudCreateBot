import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError, CLoudCreateError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The user to kick")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the kick"),
    )
.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  category: "moderation",

  async execute(interaction, config, client) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        throw new CLoudCreateError(
          "User lacks permission",
          ErrorTypes.PERMISSION,
          "You do not have permission to kick members."
        );
      }

      const targetUser = interaction.options.getUser("target");
      const member = interaction.options.getMember("target");
      const reason = interaction.options.getString("reason") || "No reason provided";

      if (!targetUser) {
        throw new CLoudCreateError(
          'Missing target user',
          ErrorTypes.USER_INPUT,
          'You must specify a user to kick.',
          { subtype: 'invalid_user' },
        );
      }

      if (targetUser.id === interaction.user.id) {
        throw new CLoudCreateError(
          "Cannot kick self",
          ErrorTypes.VALIDATION,
          "You cannot kick yourself."
        );
      }

      if (targetUser.id === client.user.id) {
        throw new CLoudCreateError(
          "Cannot kick bot",
          ErrorTypes.VALIDATION,
          "You cannot kick the bot."
        );
      }

      if (!member) {
        throw new CLoudCreateError(
          "Target not found",
          ErrorTypes.USER_INPUT,
          "The target user is not currently in this server.",
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
            `👢 **Kicked** ${targetUser.tag}`,
            `**Reason:** ${reason}\n**Case ID:** #${result.caseId}`,
          ),
        ],
      });
    } catch (error) {
      logger.error('Kick command error:', error);
      await handleInteractionError(interaction, error, { subtype: 'kick_failed' });
    }
  }
};

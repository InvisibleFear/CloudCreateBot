import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, CLoudCreateError, ErrorTypes } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("flip")
    .setDescription("Підкидає монетку (Орел чи Решка)."),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      const result = Math.random() < 0.5 ? "Орел" : "Решка";
      const emoji = result === "Орел" ? "🪙" : "🔮";

      const embed = successEmbed(
        `Монетка приземлилася на... **${result}** ${emoji}!`,
        "Орел чи Решка?"
      );

      await InteractionHelper.safeReply(interaction, { embeds: [embed] });
      logger.debug(`Flip command executed by user ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Flip command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'flip',
        source: 'flip_command'
      });
    }
  },
};
import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const EMBED_DESCRIPTION_LIMIT = 4096;

export default {
    data: new SlashCommandBuilder()
    .setName("fight")
    .setDescription("Починає симуляцію бою 1 на 1.")
    .addUserOption((option) =>
      option
        .setName("opponent")
        .setDescription("Супротивник, з яким ви хочете битися.")
        .setRequired(true),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const challenger = interaction.user;
      const opponent = interaction.options.getUser("opponent");

      if (challenger.id === opponent.id) {
        const embed = warningEmbed(
          `**${challenger.username}**, ви не можете битися самі з собою! Це нічия ще до початку.`,
          "⚔️ Недійсний виклик"
        );
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      if (opponent.bot) {
        const embed = warningEmbed(
          "Ви не можете битися з ботами! Киньте виклик реальному гравцеві.",
          "⚔️ Недійсний супротивник"
        );
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      const winner = rand(0, 1) === 0 ? challenger : opponent;
      const loser = winner.id === challenger.id ? opponent : challenger;
      const rounds = rand(3, 7);
      const damage = rand(10, 50);

      const log = [];
      log.push(
        `💥 **${challenger.username}** викликає **${opponent.username}** на дуель! (Максимум ${rounds} раундів)`,
      );

      for (let i = 1; i <= rounds; i++) {
        const attacker = rand(0, 1) === 0 ? challenger : opponent;
        const target = attacker.id === challenger.id ? opponent : challenger;
        const action = [
          "завдає потужного удару",
          "завдає критичного удару",
          "використовує слабке заклинання",
          "парує та контратакує",
        ][rand(0, 3)];
        log.push(
          `\n**Раунд ${i}:** ${attacker.username} ${action} проти ${target.username} і завдає ${rand(1, damage)} шкоди!`,
        );
      }

      const outcomeText = log.join("\n");
      const winnerText = `👑 **${winner.username}** перемагає ${loser.username} та здобуває тріумф!`;
      const fullDescription = `${outcomeText}\n\n${winnerText}`;

      const description = fullDescription.length <= EMBED_DESCRIPTION_LIMIT
        ? fullDescription
        : `${fullDescription.slice(0, EMBED_DESCRIPTION_LIMIT - 15)}\n\n...`;

      const embed = successEmbed(
        description,
        "🏆 Дуель завершено!"
      );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Fight command executed between ${challenger.id} and ${opponent.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Fight command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'fight',
        source: 'fight_command'
      });
    }
  },
};
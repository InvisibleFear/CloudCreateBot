import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Видалити певну кількість повідомлень")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Кількість повідомлень (1-100)")
        .setRequired(true),
    )
.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: "moderation",
  abuseProtection: { maxAttempts: 5, windowMs: 60_000 },

  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction, {
      flags: MessageFlags.Ephemeral,
    });
    if (!deferSuccess) {
      logger.warn(`Помилка відкладення взаємодії purge`, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'purge'
      });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
      return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Вам потрібне право `Управління повідомленнями` для видалення повідомлень.' });

    const amount = interaction.options.getInteger("amount");
    const channel = interaction.channel;

    if (amount < 1 || amount > 100)
      return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Вкажіть кількість від 1 до 100.' });

    try {
      const fetched = await channel.messages.fetch({ limit: amount });
      const deleted = await channel.bulkDelete(fetched, true);
      const deletedCount = deleted.size;

      const purgeEmbed = createEmbed(
        "🗑️ Повідомлення видалено (журнал дій)",
        `${deletedCount} повідомлень видалено модератором ${interaction.user}.`,
      )
.setColor(getColor('moderation'))
        .addFields(
          { name: "Канал", value: channel.toString(), inline: true },
          {
            name: "Модератор",
            value: `${interaction.user.tag} (${interaction.user.id})`,
            inline: true,
          },
          { name: "Кількість", value: `${deletedCount} повідомлень`, inline: false },
        );

      await logEvent({
        client,
        guild: interaction.guild,
        event: {
          action: "Повідомлення видалено",
          target: `${channel} (${deletedCount} повідомлень)`,
          executor: `${interaction.user.tag} (${interaction.user.id})`,
          reason: `Видалено ${deletedCount} повідомлень`,
          metadata: {
            channelId: channel.id,
            messageCount: deletedCount,
            requestedAmount: amount,
            moderatorId: interaction.user.id
          }
        }
      });

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          successEmbed(
            "🗑️ Повідомлення видалено",
            `Видалено ${deletedCount} повідомлень у ${channel}.`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });

      setTimeout(() => {
        interaction.deleteReply().catch(err => 
          logger.debug('Не вдалося автоматично видалити відповідь purge:', err)
        );
      }, 3000);
    } catch (error) {
      logger.error('Помилка команди purge:', error);
      await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Під час видалення повідомлень виникла помилка. Зверніть увагу: повідомлення старші за 14 днів не можна видаляти масово.' });
    }
  }
};
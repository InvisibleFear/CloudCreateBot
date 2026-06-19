import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription(
      "Заблокувати поточний канал (заборонити @everyone надсилати повідомлення).",
    )
.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  category: "moderation",

  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn(`Помилка відкладення взаємодії lock`, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'lock'
      });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Вам потрібне право `Керування каналами` для блокування каналів.' });

    const channel = interaction.channel;
    const everyoneRole = interaction.guild.roles.everyone;

    try {
      const currentPermissions = channel.permissionsFor(everyoneRole);
      if (currentPermissions.has(PermissionFlagsBits.SendMessages) === false) {
        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `${channel} вже заблоковано.` });
      }

      await channel.permissionOverwrites.edit(
        everyoneRole,
        { SendMessages: false },
{ type: 0, reason: `Канал заблоковано модератором ${interaction.user.tag}` },
      );

      const lockEmbed = createEmbed(
        "🔒 Канал заблоковано (журнал дій)",
        `${channel} було заблоковано модератором ${interaction.user}.`,
      )
.setColor(getColor('moderation'))
        .addFields(
          { name: "Канал", value: channel.toString(), inline: true },
          {
            name: "Модератор",
            value: `${interaction.user.tag} (${interaction.user.id})`,
            inline: true,
          },
        );

      await logEvent({
        client,
        guild: interaction.guild,
        event: {
          action: "Канал заблоковано",
          target: channel.toString(),
          executor: `${interaction.user.tag} (${interaction.user.id})`,
          metadata: {
            channelId: channel.id,
            category: channel.parent?.name || 'Немає',
            moderatorId: interaction.user.id
          }
        }
      });

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          successEmbed(
            `🔒 **Канал заблоковано**`,
            `${channel} тепер заблоковано. Ніхто не може писати тут.`,
          ),
        ],
      });
    } catch (error) {
      logger.error('Помилка команди lock:', error);
      await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: "Під час блокування каналу виникла помилка. Перевірте мої права (потрібне 'Керування каналами')." });
    }
  }
};
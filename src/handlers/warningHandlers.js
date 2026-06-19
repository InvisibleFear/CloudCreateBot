import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { successEmbed } from '../utils/embeds.js';
import { WarningService } from '../services/warningService.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { logger } from '../utils/logger.js';
import { replyUserError, ErrorTypes } from '../utils/errorHandler.js';

const warningDeleteSpecificHandler = {
  name: 'warning_delete_specific',
  async execute(interaction, client) {
    try {
      const [, targetUserId, originalModeratorId] = interaction.customId.split(':');
      
      if (interaction.user.id !== originalModeratorId) {
        return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Лише модератор, який переглядав ці попередження, може видалити їх.' });
      }

      const modal = new ModalBuilder()
        .setCustomId(`warning_delete_modal:${targetUserId}:${interaction.user.id}`)
        .setTitle('Видалити попередження');

      const warningNumberInput = new TextInputBuilder()
        .setCustomId('warning_number')
        .setLabel('Номер попередження (#1, #2 тощо)')
        .setPlaceholder('Введіть номер попередження для видалення')
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(10);

      const actionRow = new ActionRowBuilder().addComponents(warningNumberInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } catch (error) {
      logger.error('Warning delete specific button error:', error);
      await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Не вдалося відкрити вікно видалення попередження.' });
    }
  }
};

const warningClearAllHandler = {
  name: 'warning_clear_all',
  async execute(interaction, client) {
    try {
      const [, targetUserId, originalModeratorId] = interaction.customId.split(':');
      
      if (interaction.user.id !== originalModeratorId) {
        return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Лише модератор, який переглядав ці попередження, може очистити їх.' });
      }

      const targetUser = await client.users.fetch(targetUserId).catch(() => null);
      const targetName = targetUser ? targetUser.username : 'цього користувача';

      const clearModal = new ModalBuilder()
        .setCustomId(`warning_clear_confirm_modal:${targetUserId}:${interaction.user.id}`)
        .setTitle('Очистити всі попередження')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('delete_confirmation')
              .setLabel(`Введіть "DELETE" для підтвердження`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('DELETE')
              .setMaxLength(6)
              .setMinLength(6)
              .setRequired(true)
          )
        );

      await interaction.showModal(clearModal);
    } catch (error) {
      logger.error('Warning clear all button error:', error);
      await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Не вдалося відкрити вікно підтвердження.' });
    }
  }
};

async function warningDeleteModalHandler(interaction, client) {
  try {
    const [, targetUserId, originalModeratorId] = interaction.customId.split(':');
    
    if (interaction.user.id !== originalModeratorId) {
      return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Лише модератор, який переглядав ці попередження, може видалити їх.' });
    }

    const warningNumberInput = interaction.fields.getTextInputValue('warning_number');
    const warningNumber = parseInt(warningNumberInput.replace('#', '').trim(), 10);

    if (isNaN(warningNumber) || warningNumber < 1) {
      return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Будь ласка, введіть дійсний номер попередження (наприклад, 1, 2, 3).' });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    const guildId = interaction.guildId;
    const warnings = await WarningService.getWarnings(guildId, targetUserId);

    if (warningNumber > warnings.length) {
      return await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: `Попередження #${warningNumber} не існує. У цього користувача лише ${warnings.length} попередження(ь).` });
    }

    const warningToDelete = warnings[warningNumber - 1];
    const result = await WarningService.removeWarning(guildId, targetUserId, warningToDelete.id);

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete warning');
    }

    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    const targetName = targetUser ? targetUser.username : 'користувача';

    logger.info(`[MODERATION] Warning deleted for ${targetUserId} in ${guildId} by ${interaction.user.id}`, {
      warningId: warningToDelete.id,
      reason: warningToDelete.reason,
      warningNumber
    });

    await interaction.editReply({
      embeds: [successEmbed(`Попередження #${warningNumber} для **${targetName}** було видалено.\n\n**Причина була:** ${warningToDelete.reason.substring(0, 100)}`, '✅ Попередження видалено')]
    });
  } catch (error) {
    logger.error('Warning delete modal handler error:', error);
    await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Не вдалося видалити попередження.' });
  }
}

async function warningClearConfirmModalHandler(interaction, client) {
  try {
    const [, targetUserId, originalModeratorId] = interaction.customId.split(':');
    
    if (interaction.user.id !== originalModeratorId) {
      return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Лише модератор, який переглядав ці попередження, може очистити їх.' });
    }

    const confirmation = interaction.fields.getTextInputValue('delete_confirmation').trim();

    if (confirmation !== 'DELETE') {
      return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ви повинні ввести саме "DELETE" для підтвердження очищення всіх попереджень.' });
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const guildId = interaction.guildId;
    const result = await WarningService.clearWarnings(guildId, targetUserId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to clear warnings');
    }

    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    const targetName = targetUser ? targetUser.username : 'користувача';

    logger.info(`[MODERATION] All warnings cleared for ${targetUserId} in ${guildId} by ${interaction.user.id}`);

    await interaction.editReply({
      embeds: [successEmbed(`Усі попередження для **${targetName}** були очищені. Вилучено **${result.count}** попередження(ь).`, '✅ Попередження очищено')]
    });
  } catch (error) {
    logger.error('Warning clear confirm modal handler error:', error);
    await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Не вдалося очистити попередження.' });
  }
}

export {
  warningDeleteSpecificHandler,
  warningClearAllHandler,
  warningDeleteModalHandler,
  warningClearConfirmModalHandler,
};

export default {
  name: 'warning_delete_modal',
  execute: warningDeleteModalHandler
};

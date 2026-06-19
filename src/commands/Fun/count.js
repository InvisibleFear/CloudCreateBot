import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import {
  getCountingGameConfig,
  activateCountingGame,
  disableCountingGame,
  resetCountingGame,
  buildCountingLeaderboard,
  getCountingSystemChoices,
  getCountingSystemLabel,
  getExpectedCountValue,
} from '../../services/countingGameService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('count')
    .setDescription('Керувати грою в рахунок на сервері')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Запустити гру в рахунок у текстовому каналі')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Канал, де буде відбуватися рахунок')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((option) =>
          option
            .setName('system')
            .setDescription('Система рахунку, яку використовувати')
            .setRequired(true)
            .addChoices(...getCountingSystemChoices()),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('disable').setDescription('Вимкнути гру в рахунок для цього сервера'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Переглянути поточний статус гри в рахунок'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription('Скинути поточну послідовність рахунку')
        .addIntegerOption((option) =>
          option
            .setName('start')
            .setDescription('Число, з якого почати після скидання')
            .setMinValue(1),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leaderboard').setDescription('Показати таблицю лідерів гри в рахунок'),
    ),
  category: 'Fun',

  async execute(interaction) {
    try {
      const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      if (!deferSuccess) {
        logger.warn('Count command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Вам потрібні права на **Керування сервером**, щоб використовувати цю команду.' });
      }

      const guildId = interaction.guildId;
      const subcommand = interaction.options.getSubcommand();
      const config = await getCountingGameConfig(interaction.client, guildId);

      if (subcommand === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const system = interaction.options.getString('system');
        if (!channel || channel.type !== ChannelType.GuildText) {
          return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Будь ласка, оберіть текстовий канал для гри в рахунок.' });
        }

        if (config.enabled && config.channelId && config.channelId !== channel.id) {
          return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Цей сервер вже має активний канал рахунку: <#${config.channelId}>. Спочатку вимкніть поточну гру або використовуйте цей канал.` });
        }

        await activateCountingGame(interaction.client, guildId, channel.id, system);
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              `Гра в рахунок тепер активна у ${channel} з використанням системи **${getCountingSystemLabel(system)}**. Гравці повинні рахувати починаючи з **1** і не можуть писати два числа поспіль.`,
              'Гру в рахунок увімкнено',
            ),
          ],
        });
      }

      if (subcommand === 'disable') {
        if (!config.enabled) {
          return await InteractionHelper.safeEditReply(interaction, {
            embeds: [infoEmbed('Гру в рахунок вже вимкнено на цьому сервері.', 'Гру в рахунок вимкнено')],
          });
        }

        await disableCountingGame(interaction.client, guildId);
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [successEmbed('Гру в рахунок було вимкнено.', 'Гру в рахунок вимкнено')],
        });
      }

      if (subcommand === 'status') {
        const fields = [
          { name: 'Увімкнено', value: config.enabled ? 'Так' : 'Ні', inline: true },
          { name: 'Канал', value: config.channelId ? `<#${config.channelId}>` : 'Не налаштовано', inline: true },
          { name: 'Система', value: getCountingSystemLabel(config.system), inline: true },
          { name: 'Наступне число', value: getExpectedCountValue(config), inline: true },
          { name: 'Поточна серія', value: `${config.currentStreak}`, inline: true },
          { name: 'Найкраща серія', value: `${config.bestStreak || 0}`, inline: true },
          { name: 'Останній гравець', value: config.lastUserId ? `<@${config.lastUserId}>` : 'Немає', inline: true },
        ];

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: 'Статус гри в рахунок',
              description: 'Огляд поточної конфігурації гри в рахунок.',
              fields,
              color: 'primary',
            }),
          ],
        });
      }

      if (subcommand === 'reset') {
        if (!config.enabled) {
          return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Спочатку увімкніть гру в рахунок за допомогою `/count setup`.' });
        }

        const startNumber = interaction.options.getInteger('start') || 1;
        await resetCountingGame(interaction.client, guildId, startNumber);

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              `Послідовність рахунку було скинуто. Почніть знову з **${startNumber}** у <#${config.channelId}>.`,
              'Рахунок скинуто',
            ),
          ],
        });
      }

      if (subcommand === 'leaderboard') {
        const leaderboard = buildCountingLeaderboard(config, interaction.guild);

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: 'Таблиця лідерів гри в рахунок',
              description: leaderboard.length > 0 ? leaderboard.join('\n') : 'Користувачі ще не рахували.',
              color: 'primary',
            }),
          ],
        });
      }

      return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Будь ласка, оберіть дійсну дію гри в рахунок.' });
    } catch (error) {
      logger.error('Count command error:', error);
      return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Сталася помилка під час керування грою в рахунок.' });
    }
  },
};

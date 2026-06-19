import { PermissionsBitField, EmbedBuilder } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../../services/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Доступ заборонено')
                .setDescription('Вам потрібне право **Керувати сервером**, щоб налаштувати канал днів народження.');
            return InteractionHelper.safeReply(interaction, {
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            const channel = interaction.options.getChannel('channel');
            const guildId = interaction.guildId;
            const guildConfig = await getGuildConfig(client, guildId);

            if (channel) {
                guildConfig.birthdayChannelId = channel.id;
                await setGuildConfig(client, guildId, guildConfig);
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎂 Оголошення днів народження увімкнено')
                    .setDescription(`Оголошення про дні народження тепер надсилатимуться у ${channel}.`);
                return InteractionHelper.safeReply(interaction, {
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                guildConfig.birthdayChannelId = null;
                await setGuildConfig(client, guildId, guildConfig);
                const embed = new EmbedBuilder()
                    .setColor(0xFFFF00)
                    .setTitle('Оголошення днів народження вимкнено')
                    .setDescription('Канал не вказано — оголошення про дні народження вимкнено.');
                return InteractionHelper.safeReply(interaction, {
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (error) {
            logger.error('Помилка birthday_setchannel:', error);
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚠️ Помилка налаштування')
                .setDescription('Не вдалося зберегти конфігурацію каналу для днів народження.');
            return InteractionHelper.safeReply(interaction, {
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
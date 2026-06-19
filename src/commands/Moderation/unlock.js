import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("unlock")
        .setDescription(
            "Розблокувати поточний канал (дозволити @everyone надсилати повідомлення знову).",
        )
.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Помилка відкладення взаємодії unlock`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'unlock'
            });
            return;
        }

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.ManageChannels,
            )
        )
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Вам потрібне право `Керування каналами` для розблокування каналів.' });

        const channel = interaction.channel;
        const everyoneRole = interaction.guild.roles.everyone;

        try {
            const currentPermissions = channel.permissionsFor(everyoneRole);
            if (
                currentPermissions.has(PermissionFlagsBits.SendMessages) ===
                    true ||
                currentPermissions.has(PermissionFlagsBits.SendMessages) ===
                    null
            ) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `${channel} не заблоковано явно (всі вже можуть надсилати повідомлення).` });
            }

            await channel.permissionOverwrites.edit(
                everyoneRole,
                { SendMessages: true },
                {
                    type: 0,
                    reason: `Канал розблоковано модератором ${interaction.user.tag}`,
},
            );

            const unlockEmbed = createEmbed(
                "🔓 Канал розблоковано (журнал дій)",
                `${channel} розблоковано модератором ${interaction.user}.`,
            )
.setColor(getColor('success'))
                .addFields(
                    {
                        name: "Канал",
                        value: channel.toString(),
                        inline: true,
                    },
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
                    action: "Канал розблоковано",
                    target: channel.toString(),
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    metadata: {
                        channelId: channel.id,
                        category: channel.parent?.name || 'Немає'
                    }
                }
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        `🔓 **Канал розблоковано**`,
                        `${channel} тепер розблоковано. Можна писати!`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Помилка команди unlock:', error);
            await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: "Під час розблокування каналу виникла помилка. Перевірте мої права (потрібне 'Керування каналами')." });
        }
    }
};
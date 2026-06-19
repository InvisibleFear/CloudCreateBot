import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { sanitizeMarkdown } from '../../utils/validation.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("dm")
        .setDescription("Надіслати особисте повідомлення користувачу (тільки для персоналу)")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Користувач, якому надіслати ПП")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("Текст повідомлення")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName("anonymous")
                .setDescription("Надіслати анонімно (за замовчуванням: ні)")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),
    category: "Moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Помилка відкладення взаємодії dm`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'dm'
            });
            return;
        }

    const targetUser = interaction.options.getUser("user");
        const message = interaction.options.getString("message");
        const anonymous = interaction.options.getBoolean("anonymous") || false;

        try {
            
            if (message.length > 2000) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Повідомлення не може перевищувати 2000 символів.' });
            }

            if (targetUser.bot) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Не можна надсилати ПП ботам.' });
            }

            const sanitized = sanitizeMarkdown(message);

            const dmChannel = await targetUser.createDM();
            
            await dmChannel.send({
                embeds: [
                    successEmbed(
                        anonymous ? "Повідомлення від команди персоналу" : `Повідомлення від ${interaction.user.tag}`,
                        sanitized
                    ).setFooter({
                        text: `Ви не можете відповісти на це повідомлення. | ID журналу: ${interaction.id}`
                    })
                ]
            });

            await logEvent({
                client: interaction.client,
                guild: interaction.guild,
                event: {
                    action: "ПП надіслано",
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `Анонімно: ${anonymous ? 'Так' : 'Ні'}`,
                    metadata: {
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        anonymous,
                        messageLength: sanitized.length
                    }
                }
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "✅ ПП надіслано",
                        `Повідомлення успішно надіслано ${targetUser.tag}`
                    ),
                ],
            });
        } catch (error) {
            logger.error('Помилка команди dm:', error);
            
if (error.code === 50007) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Не вдалося надіслати ПП ${targetUser.tag}. Можливо, у них вимкнено особисті повідомлення.` });
            }
            
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Не вдалося надіслати ПП: ${error.message}` });
        }
    }
};
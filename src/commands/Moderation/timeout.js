import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { CLoudCreateError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';

const durationChoices = [
    { name: "5 хвилин", value: 5 },
    { name: "10 хвилин", value: 10 },
    { name: "30 хвилин", value: 30 },
    { name: "1 година", value: 60 },
    { name: "6 годин", value: 360 },
    { name: "1 день", value: 1440 },
    { name: "1 тиждень", value: 10080 },
];

export default {
    data: new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Дати тайм-аут користувачу на певний час.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("Користувач для тайм-ауту")
                .setRequired(true),
        )
        .addIntegerOption(
            (option) =>
                option
                    .setName("duration")
                    .setDescription("Тривалість тайм-ауту")
                    .setRequired(true)
.addChoices(...durationChoices),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("Причина тайм-ауту"),
        )
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Помилка відкладення взаємодії timeout`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'timeout'
            });
            return;
        }

        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                throw new CLoudCreateError(
                    "User lacks permission",
                    ErrorTypes.PERMISSION,
                    "Вам потрібне право `Модерування учасників` для встановлення тайм-ауту."
                );
            }

            const targetUser = interaction.options.getUser("target");
            const member = interaction.options.getMember("target");
            const durationMinutes = interaction.options.getInteger("duration");
            const reason = interaction.options.getString("reason") || "Причина не вказана";

            if (!targetUser) {
                throw new CLoudCreateError(
                    'Missing target user',
                    ErrorTypes.USER_INPUT,
                    'Ви повинні вказати користувача для тайм-ауту.',
                    { subtype: 'invalid_user' },
                );
            }

            if (targetUser.id === interaction.user.id) {
                throw new CLoudCreateError(
                    "Cannot timeout self",
                    ErrorTypes.VALIDATION,
                    "Ви не можете дати тайм-аут собі."
                );
            }
            if (targetUser.id === client.user.id) {
                throw new CLoudCreateError(
                    "Cannot timeout bot",
                    ErrorTypes.VALIDATION,
                    "Ви не можете дати тайм-аут боту."
                );
            }
            if (!member) {
                throw new CLoudCreateError(
                    "Target not found",
                    ErrorTypes.USER_INPUT,
                    "Цільовий користувач зараз не знаходиться на цьому сервері."
                );
            }

            const durationMs = durationMinutes * 60 * 1000;
            const result = await ModerationService.timeoutUser({
                guild: interaction.guild,
                member,
                moderator: interaction.member,
                durationMs,
                reason,
            });

            const durationDisplay =
                durationChoices.find((c) => c.value === durationMinutes)
                    ?.name || `${durationMinutes} хвилин`;

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        `⏳ **Тайм-аут** ${targetUser.tag} на ${durationDisplay}.`,
                        `**Причина:** ${reason}\n**ID справи:** #${result.caseId}`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Помилка команди timeout:', error);
            await handleInteractionError(interaction, error, { subtype: 'timeout_failed' });
        }
    }
};

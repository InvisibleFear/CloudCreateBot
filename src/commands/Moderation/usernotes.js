import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { getFromDb, setInDb, deleteFromDb } from '../../utils/database.js';
import { sanitizeInput } from '../../utils/validation.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
function getUserNotesKey(guildId, userId) {
    return `moderation_user_notes_${guildId}_${userId}`;
}

function getGuildNotesListKey(guildId) {
    return `moderation_user_notes_list_${guildId}`;
}

export default {
    data: new SlashCommandBuilder()
        .setName("usernotes")
        .setDescription("Керувати нотатками про користувача для цілей модерації")
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Додати нотатку до користувача")
                .addUserOption(option =>
                    option
                        .setName("target")
                        .setDescription("Користувач, до якого додається нотатка")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("note")
                        .setDescription("Текст нотатки")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Тип нотатки")
                        .addChoices(
                            { name: "Попередження", value: "warning" },
                            { name: "Позитивна", value: "positive" },
                            { name: "Нейтральна", value: "neutral" },
                            { name: "Тривога", value: "alert" }
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("view")
                .setDescription("Переглянути нотатки про користувача")
                .addUserOption(option =>
                    option
                        .setName("target")
                        .setDescription("Користувач, нотатки якого переглядаються")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Видалити конкретну нотатку про користувача")
                .addUserOption(option =>
                    option
                        .setName("target")
                        .setDescription("Користувач, з якого видаляється нотатка")
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("index")
                        .setDescription("Індекс нотатки для видалення")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("clear")
                .setDescription("Очистити всі нотатки про користувача")
                .addUserOption(option =>
                    option
                        .setName("target")
                        .setDescription("Користувач, нотатки якого очищуються")
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    category: "moderation",

    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'У вас немає права керувати нотатками про користувачів.' });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser("target");
        const guildId = interaction.guild.id;

        if (subcommand !== "view" && subcommand !== "remove" && subcommand !== "clear" && subcommand !== "add") {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Виберіть дійсну підкоманду.' });
        }

        let notes = [];
        if (targetUser) {
            const notesKey = getUserNotesKey(guildId, targetUser.id);
            notes = await getFromDb(notesKey, []);
        }

        try {
            switch (subcommand) {
                case "add":
                    return await handleAddNote(interaction, targetUser, notes, guildId);
                case "view":
                    return await handleViewNotes(interaction, targetUser, notes);
                case "remove":
                    return await handleRemoveNote(interaction, targetUser, notes, guildId);
                case "clear":
                    return await handleClearNotes(interaction, targetUser, notes, guildId);
                default:
                    return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Виберіть дійсну підкоманду.' });
            }
        } catch (error) {
            logger.error(`Помилка команди usernotes (${subcommand}):`, error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Під час обробки запиту виникла помилка. Спробуйте ще раз.' });
        }
    }
};

async function handleAddNote(interaction, targetUser, notes, guildId) {
    let note = interaction.options.getString("note").trim();
    const type = interaction.options.getString("type") || "neutral";

    if (note.length > 1000) {
        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Нотатки не можуть перевищувати 1000 символів.' });
    }

    if (note.length === 0) {
        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Нотатка не може бути порожньою.' });
    }

    note = sanitizeInput(note);

    const noteData = {
        id: Date.now(),
        content: note,
        type: type,
        author: interaction.user.tag,
        authorId: interaction.user.id,
        timestamp: new Date().toISOString()
    };

    notes.push(noteData);

    const notesKey = getUserNotesKey(guildId, targetUser.id);
    await setInDb(notesKey, notes);

    const typeInfo = getNoteTypeInfo(type);

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            successEmbed(
                `${typeInfo.emoji} Нотатку додано`,
                `Додано **${getTypeLabel(type)}** нотатку для **${targetUser.tag}**:\n\n` +
                `> ${note}\n\n` +
                `**Модератор:** ${interaction.user.tag}\n` +
                `**Всього нотаток:** ${notes.length}`
            )
        ]
    });
}

async function handleViewNotes(interaction, targetUser, notes) {
    if (notes.length === 0) {
        return InteractionHelper.safeReply(interaction, {
            embeds: [
                infoEmbed(
                    "📝 Нотаток немає",
                    `Для **${targetUser.tag}** немає жодних нотаток.`
                ),
            ],
        });
    }

    const sortedNotes = [...notes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let description = `**Нотатки про ${targetUser.tag} (${targetUser.id}):**\n\n`;
    
    sortedNotes.forEach((note, index) => {
        const typeInfo = getNoteTypeInfo(note.type);
        const date = new Date(note.timestamp).toLocaleDateString('uk-UA');
        description += `${typeInfo.emoji} **Нотатка #${index + 1}** (${getTypeLabel(note.type)}) — ${date}\n`;
        description += `> ${note.content}\n`;
        description += `*Додано: ${note.author}*\n\n`;
    });

    if (description.length > 4000) {
        description = description.substring(0, 3900) + "\n... *(скорочено)*";
    }

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            infoEmbed(
                `📝 Нотатки про користувача (${notes.length})`,
                description
            )
        ]
    });
}

async function handleRemoveNote(interaction, targetUser, notes, guildId) {
const index = interaction.options.getInteger("index") - 1;

    if (index < 0 || index >= notes.length) {
        return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: `Вкажіть дійсний індекс нотатки (1-${notes.length}).` });
    }

    const removedNote = notes[index];
    notes.splice(index, 1);

    const notesKey = getUserNotesKey(guildId, targetUser.id);
    await setInDb(notesKey, notes);

    const typeInfo = getNoteTypeInfo(removedNote.type);

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            successEmbed(
                `${typeInfo.emoji} Нотатку видалено`,
                `Видалено нотатку #${index + 1} для **${targetUser.tag}**:\n\n` +
                `> ${removedNote.content}\n\n` +
                `**Залишилось нотаток:** ${notes.length}`
            )
        ]
    });
}

async function handleClearNotes(interaction, targetUser, notes, guildId) {
    const noteCount = notes.length;
    
    if (noteCount === 0) {
        return InteractionHelper.safeReply(interaction, {
            embeds: [
                infoEmbed(
                    "Нотаток для очищення немає",
                    `Для **${targetUser.tag}** немає нотаток, які можна очистити.`
                ),
            ],
        });
    }

    notes.length = 0;

    const notesKey = getUserNotesKey(guildId, targetUser.id);
    await setInDb(notesKey, notes);

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            successEmbed(
                "🗑️ Нотатки очищено",
                `Очищено **${noteCount}** нотаток для **${targetUser.tag}**.`
            )
        ]
    });
}

function getNoteTypeInfo(type) {
    const types = {
        warning: { emoji: "⚠️", color: "#FF6B6B" },
        positive: { emoji: "✅", color: "#51CF66" },
        neutral: { emoji: "📝", color: "#74C0FC" },
        alert: { emoji: "🚨", color: "#FFD43B" }
    };
    
    return types[type] || types.neutral;
}

function getTypeLabel(type) {
    const labels = {
        warning: "Попередження",
        positive: "Позитивна",
        neutral: "Нейтральна",
        alert: "Тривога"
    };
    return labels[type] || type;
}
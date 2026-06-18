import {
    SlashCommandBuilder,
    ActionRowBuilder,
} from "discord.js";
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from "../../utils/embeds.js";
import {
    createSelectMenu,
} from "../../utils/components.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_SELECT_ID = "help-category-select";
const ALL_COMMANDS_ID = "help-all-commands";
const HELP_MENU_TIMEOUT_MS = 5 * 60 * 1000;

const CATEGORY_ICONS = {
    Core: "ℹ️",
    Moderation: "🛡️",
    Economy: "💰",
    Fun: "🎮",
    Leveling: "📊",
    Utility: "🔧",
    Ticket: "🎫",
    Welcome: "👋",
    Giveaway: "🎉",
    Counter: "🔢",
    Tools: "🛠️",
    Search: "🔍",
    "Reaction Roles": "🎭",
    Community: "👥",
    Birthday: "🎂",
    "Join To Create": "🔌",
    Verification: "✅",
};

function formatCategoryName(rawCategory) {
    return rawCategory
        .replace(/_/g, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function createInitialHelpMenu(client) {
    const commandsPath = path.join(__dirname, "../../commands");
    const categoryDirs = (
        await fs.readdir(commandsPath, { withFileTypes: true })
    )
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort();

    const options = [
        {
            label: "📋 Всі команди",
            description: "Переглянути всі доступні команди одним списком",
            value: ALL_COMMANDS_ID,
        },
        ...categoryDirs.map((category) => {
            const categoryName = formatCategoryName(category);
            const icon = CATEGORY_ICONS[categoryName] || "🔍";
            return {
                label: `${icon} ${categoryName}`,
                description: `Переглянути команди категорії ${categoryName}`,
                value: category,
            };
        }),
    ];

    const botName = client?.user?.username || "Bot";
    const embed = createEmbed({
        title: `📖 ${botName} — Довідка`,
        description: 'Налаштуй сервер, обери що увімкнути, та переглядай команди нижче.',
        color: 'primary',
        thumbnail: client.user?.displayAvatarURL?.({ size: 1024 }),
        fields: [
            {
                name: '🚀 Початок роботи',
                value: [
                    '**1. Налаштування** — Запусти `/configwizard` щоб вказати префікс, роль модератора та логи.',
                    '**2. Увімкнення систем** — Використай `/commands dashboard` щоб вмикати або вимикати категорії.',
                    '**3. Перегляд команд** — Обери категорію в меню нижче.',
                ].join('\n'),
                inline: false,
            },
            {
                name: 'ℹ️ Як це працює',
                value: [
                    '• Dashboard-команди керують кожною функцією візуально',
                    '• Налаштування зберігаються окремо для кожного сервера',
                    '• Slash-команди та префікс працюють одночасно після активації',
                ].join('\n'),
                inline: false,
            },
        ],
    });

    embed.setFooter({
        text: "Зроблено з ❤️"
    });
    embed.setTimestamp();

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        "Обери категорію для перегляду",
        options,
    );

    return {
        embeds: [embed],
        components: [selectRow],
    };
}

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Відображає меню довідки з усіма доступними командами"),

    async execute(interaction, guildConfig, client) {
        await InteractionHelper.safeDefer(interaction);

        const { embeds, components } = await createInitialHelpMenu(client);

        await InteractionHelper.safeEditReply(interaction, {
            embeds,
            components,
        });

        setTimeout(async () => {
            try {
                if (!InteractionHelper.isInteractionValid(interaction)) {
                    return;
                }

                const closedEmbed = createEmbed({
                    title: "Довідку закрито",
                    description: "Меню довідки закрито. Використай /help щоб відкрити знову.",
                    color: "secondary",
                });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [closedEmbed],
                    components: [],
                });
            } catch (error) {

            }
        }, HELP_MENU_TIMEOUT_MS);
    },
};

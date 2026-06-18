import { logger } from '../utils/logger.js';

export const botConfig = {
  // =========================
  // BOT PRESENCE
  // =========================
  presence: {
    status: "online",
    activities: [
      {
        name: "⚙️ CloudCreate | /help",
        type: 0, // Playing
      },
    ],
  },

  // =========================
  // COMMAND BEHAVIOR
  // =========================
  commands: {
    owners: process.env.OWNER_IDS?.split(",") || [],
    defaultCooldown: 3,
    deleteCommands: false,
    testGuildId: process.env.TEST_GUILD_ID,
    prefix: process.env.PREFIX || "!",
  },

  // =========================
  // APPLICATIONS SYSTEM
  // =========================
  applications: {
    defaultQuestions: [
      { question: "Як тебе звати / твій нік у Minecraft?", required: true },
      { question: "Скільки тобі років?", required: true },
      { question: "Чи знайомий ти з модом Create? Якщо так — що найбільше любиш будувати?", required: true },
      { question: "Звідки дізнався про CloudCreate?", required: false },
    ],

    statusColors: {
      pending: "#FFA500",
      approved: "#00C853",
      denied: "#D32F2F",
    },

    // 24 години між подачами заявок
    applicationCooldown: 24,
    deleteDeniedAfter: 7,
    deleteApprovedAfter: 30,
    managerRoles: [],
  },

  // =========================
  // EMBED COLORS & BRANDING
  // — Тема: мідь, залізо, бронза, жовтогаряча пара Create
  // =========================
  embeds: {
    colors: {
      // Основні кольори CloudCreate
      primary: "#B87333",   // Мідь — головний акцент
      secondary: "#2C2C2C", // Темне залізо — фон

      // Статусні кольори
      success: "#4CAF50",
      error: "#D32F2F",
      warning: "#FF8F00",
      info: "#1565C0",

      // Нейтральні
      light: "#F5F0E8",     // Бежевий папір/паровий туман
      dark: "#1A1A1A",
      gray: "#78909C",

      // Discord-палітра
      blurple: "#5865F2",
      green: "#4CAF50",
      yellow: "#FFC107",
      fuchsia: "#EB459E",
      red: "#D32F2F",
      black: "#000000",

      // Create-специфічні кольори
      giveaway: {
        active: "#4CAF50",
        ended: "#D32F2F",
      },
      ticket: {
        open: "#4CAF50",
        claimed: "#FF8F00",
        closed: "#D32F2F",
        pending: "#78909C",
      },
      economy: "#FFC107",     // Золоті шестерні
      birthday: "#E91E63",
      moderation: "#7B1FA2",

      // Пріоритети тікетів
      priority: {
        none: "#78909C",
        low: "#1565C0",
        medium: "#2E7D32",
        high: "#E65100",
        urgent: "#B71C1C",
      },

      // Create тематичні
      create: {
        copper: "#B87333",    // Мідна труба
        brass: "#B5A642",     // Латунь
        andesite: "#8A8A8A",  // Андезит
        steam: "#CFD8DC",     // Пара
        lava: "#FF5722",      // Лава / перегрів
      },
    },
    footer: {
      text: "CloudCreate ⚙️ — Minecraft Create Server",
      icon: null,
    },
    thumbnail: null,
    author: {
      name: "CloudCreate",
      icon: null,
      url: null,
    },
  },

  // =========================
  // ECONOMY — внутрішня валюта "Шестерні" (⚙)
  // =========================
  economy: {
    currency: {
      name: "шестерня",
      namePlural: "шестерень",
      symbol: "⚙",
    },

    startingBalance: 50,       // Стартовий бонус новачкам
    baseBankCapacity: 500000,

    dailyAmount: 150,          // /daily — щоденний збір ресурсів

    workMin: 20,
    workMax: 150,              // /work — "завод" дає більше ніж жебрацтво

    begMin: 5,
    begMax: 30,

    robSuccessRate: 0.35,      // Трохи важче обікрасти
    robFailJailTime: 7200000,  // 2 години в'язниці за невдалий рейд
  },

  // =========================
  // SHOP
  // =========================
  shop: {
    // Ролі, предмети та кастомний контент додаються через базу
  },

  // =========================
  // TICKET SYSTEM
  // =========================
  tickets: {
    defaultCategory: null,
    supportRoles: [],

    priorities: {
      none: {
        emoji: "⚪",
        color: "#78909C",
        label: "Без пріоритету",
      },
      low: {
        emoji: "🟢",
        color: "#2E7D32",
        label: "Низький",
      },
      medium: {
        emoji: "🟡",
        color: "#F9A825",
        label: "Середній",
      },
      high: {
        emoji: "🔴",
        color: "#E65100",
        label: "Високий",
      },
      urgent: {
        emoji: "🚨",
        color: "#B71C1C",
        label: "Критичний",
      },
    },

    defaultPriority: "none",
    archiveCategory: null,
    logChannel: null,
  },

  // =========================
  // GIVEAWAY SETTINGS
  // =========================
  giveaways: {
    defaultDuration: 86400000,  // 24 год
    minimumWinners: 1,
    maximumWinners: 5,
    minimumDuration: 600000,    // 10 хвилин мінімум
    maximumDuration: 2592000000,
    allowedRoles: [],
    bypassRoles: [],
  },

  // =========================
  // BIRTHDAY
  // =========================
  birthday: {
    defaultRole: null,
    announcementChannel: null,
    timezone: "Europe/Kiev",  // Українська таймзона
  },

  // =========================
  // VERIFICATION
  // =========================
  verification: {
    defaultMessage:
      "⚙️ Ласкаво просимо до **CloudCreate**!\nНатисни кнопку нижче, щоб верифікуватися та отримати доступ до сервера.",
    defaultButtonText: "⚙️ Верифікуватися",

    autoVerify: {
      defaultCriteria: "account_age",
      defaultAccountAgeDays: 3,   // Акаунт старший 3 днів
      serverSizeThreshold: 500,
      minAccountAge: 1,
      maxAccountAge: 365,
      sendDMNotification: true,
      criteria: {
        account_age: "Акаунт має бути старшим за вказану кількість днів",
        server_size: "Авто-верифікація якщо менше 500 учасників",
        none: "Усі одразу",
      },
    },

    verificationCooldown: 5000,
    maxVerificationAttempts: 3,
    attemptWindow: 60000,
    maxCooldownEntries: 10000,
    maxAttemptEntries: 10000,
    cooldownCleanupInterval: 300000,
    maxAuditMetadataBytes: 4096,
    maxInMemoryAuditEntries: 1000,
    logAllVerifications: true,
    keepAuditTrail: true,
  },

  // =========================
  // WELCOME / GOODBYE
  // =========================
  welcome: {
    defaultWelcomeMessage:
      "⚙️ Вітаємо, {user}, у **CloudCreate**! Ти наш {memberCount}-й гравець. Перевір канал #правила та беги будувати машини! 🏭",
    defaultGoodbyeMessage:
      "**{user}** залишив завод. Тепер нас {memberCount}. Двері завжди відкриті 🚪",
    defaultWelcomeChannel: null,
    defaultGoodbyeChannel: null,
  },

  // =========================
  // COUNTER CHANNELS
  // =========================
  counters: {
    defaults: {
      name: "{name} Counter",
      description: "Server {name} counter",
      type: "voice",
      channelName: "{name}: {count}",
    },
    permissions: {
      deny: ["VIEW_CHANNEL"],
      allow: ["VIEW_CHANNEL", "CONNECT"],
    },
    messages: {
      created: "✅ Лічильник **{name}** запущено",
      deleted: "🗑️ Лічильник **{name}** зупинено",
      updated: "🔄 Лічильник **{name}** оновлено",
    },
    types: {
      members: {
        name: "👥 Гравці",
        description: "Всього учасників",
        getCount: (guild) => guild.memberCount.toString(),
      },
      bots: {
        name: "🤖 Боти",
        description: "Кількість ботів",
        getCount: (guild) =>
          guild.members.cache.filter((m) => m.user.bot).size.toString(),
      },
      members_only: {
        name: "⚙️ Будівельники",
        description: "Живі гравці (без ботів)",
        getCount: (guild) =>
          guild.members.cache.filter((m) => !m.user.bot).size.toString(),
      },
    },
  },

  // =========================
  // GENERIC MESSAGES (Ukrainian)
  // =========================
  messages: {
    noPermission: "⛔ У тебе немає прав для цієї команди.",
    cooldownActive: "⏳ Зачекай **{time}** перед повторним використанням.",
    errorOccurred: "❌ Сталася помилка під час виконання команди.",
    missingPermissions: "🔧 Боту не вистачає прав для виконання цієї дії.",
    commandDisabled: "🚫 Ця команда наразі вимкнена.",
    maintenanceMode: "🔩 Бот на технічному обслуговуванні. Повернемось скоро!",
  },

  // =========================
  // FEATURE TOGGLES
  // =========================
  features: {
    economy: true,
    leveling: true,
    moderation: true,
    logging: true,
    welcome: true,

    tickets: true,
    giveaways: true,
    birthday: true,
    counter: true,

    verification: true,
    reactionRoles: true,
    joinToCreate: true,

    voice: true,
    search: true,
    tools: true,
    utility: true,
    community: true,
    fun: true,
  },
};

// =========================
// CONFIG VALIDATION
// =========================
export function validateConfig(config) {
  const errors = [];

  if (process.env.NODE_ENV !== 'production') {
    logger.debug('Environment variables check:');
    logger.debug('DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);
    logger.debug('TOKEN exists:', !!process.env.TOKEN);
    logger.debug('CLIENT_ID exists:', !!process.env.CLIENT_ID);
    logger.debug('GUILD_ID exists:', !!process.env.GUILD_ID);
    logger.debug('POSTGRES_HOST exists:', !!process.env.POSTGRES_HOST);
    logger.debug('NODE_ENV:', process.env.NODE_ENV);
  }

  if (!process.env.DISCORD_TOKEN && !process.env.TOKEN) {
    errors.push("Bot token is required (DISCORD_TOKEN or TOKEN)");
  }
  if (!process.env.CLIENT_ID) {
    errors.push("Client ID is required (CLIENT_ID)");
  }
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.POSTGRES_HOST) errors.push("POSTGRES_HOST required in production");
    if (!process.env.POSTGRES_USER) errors.push("POSTGRES_USER required in production");
    if (!process.env.POSTGRES_PASSWORD) errors.push("POSTGRES_PASSWORD required in production");
  }

  return errors;
}

const configErrors = validateConfig(botConfig);
if (configErrors.length > 0) {
  logger.error("Bot configuration errors:", configErrors.join("\n"));
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

export const BotConfig = botConfig;

export function getColor(path, fallback = "#78909C") {
  if (typeof path === "number") return path;
  if (typeof path === "string" && path.startsWith("#")) {
    return parseInt(path.replace("#", ""), 16);
  }
  const result = path
    .split(".")
    .reduce(
      (obj, key) => (obj && obj[key] !== undefined ? obj[key] : fallback),
      botConfig.embeds.colors
    );
  if (typeof result === "string" && result.startsWith("#")) {
    return parseInt(result.replace("#", ""), 16);
  }
  return result;
}

export function getRandomColor() {
  const colors = Object.values(botConfig.embeds.colors).flatMap((color) =>
    typeof color === "string" ? color : Object.values(color)
  );
  return colors[Math.floor(Math.random() * colors.length)];
}

export default botConfig;

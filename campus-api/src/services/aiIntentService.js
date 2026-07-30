import { AI_MODES } from "../models/AiMessage.js";
import { USER_ROLES } from "../models/User.js";

/**
 * Deterministic Campus AI mode detection.
 *
 * Gemini never chooses MongoDB queries. Campus mode is
 * selected only when the prompt clearly matches campus
 * data intents, and tools are authorized separately.
 */

const LIVE_PATTERNS = [
  /\b(latest|breaking|today'?s?|tonight|this week|live|current|right now)\b/i,
  /\b(news|headline|weather|forecast|temperature)\b/i,
  /\b(score|cricket|football|match result|ipl|world cup)\b/i,
  /\b(stock|share price|market|crypto|bitcoin)\b/i,
  /\b(movie release|ticket|showtimes?|box office)\b/i,
  /\b(government notification|exam result|admission notice)\b/i,
  /\bwho won\b/i,
  /\bwhat happened\b/i,
];

const CAMPUS_PATTERNS = [
  /\bmy (groups?|teachers?|students?|department|profile|year|unread)\b/i,
  /\b(show|list|get|how many|total|count|summary of)\b.*\b(groups?|students?|teachers?|departments?|users?|unread)\b/i,
  /\bstudents in my (year|department|class)\b/i,
  /\b(assigned students|search student|platform statistics|active users)\b/i,
  /\b(department|group|year) (summary|statistics|stats)\b/i,
  /\bwho (are|is) my (teachers?|students?)\b/i,
  /\bcampus(connect)?\b.*\b(data|stats|summary)\b/i,
];

const CAMPUS_TOOL_HINTS = Object.freeze({
  getMyProfile: [/\bmy profile\b/i, /\babout me\b/i],
  getMyGroups: [/\bmy groups?\b/i, /\bgroups? i('m| am) in\b/i],
  getDepartmentSummary: [
    /\b(my )?department\b/i,
    /\bdepartment (summary|stats|statistics)\b/i,
  ],
  getYearSummary: [
    /\bmy year\b/i,
    /\byear (summary|stats)\b/i,
    /\bstudents in my year\b/i,
  ],
  searchAuthorizedUsers: [
    /\bsearch (student|teacher|user)\b/i,
    /\bfind (a )?student\b/i,
    /\bmy teachers?\b/i,
    /\bmy (assigned )?students?\b/i,
  ],
  getGroupSummary: [/\bgroup (summary|details|info)\b/i],
  getUnreadSummary: [
    /\bunread\b/i,
    /\bsummarize (my )?chats?\b/i,
    /\bmissed messages?\b/i,
  ],
  getPlatformSummary: [
    /\bplatform (stats|statistics|summary)\b/i,
    /\btotal (students?|teachers?|users?|groups?)\b/i,
    /\bactive users?\b/i,
  ],
});

/**
 * Sanitize user prompts before tool execution / Gemini.
 * Strips control characters and enforces length.
 */
export const sanitizePrompt = (raw, maxLength) => {
  const limit =
    maxLength ||
    Number.parseInt(process.env.AI_MAX_PROMPT_LENGTH || "8000", 10);

  if (typeof raw !== "string") {
    return "";
  }

  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 8000);
};

export const detectAiMode = (prompt) => {
  const text = sanitizePrompt(prompt);

  if (!text) {
    return {
      mode: AI_MODES.GENERAL,
      tools: [],
      reason: "empty_prompt",
    };
  }

  const campusHits = CAMPUS_PATTERNS.filter((pattern) =>
    pattern.test(text)
  );

  if (campusHits.length > 0) {
    return {
      mode: AI_MODES.CAMPUS,
      tools: detectCampusTools(text),
      reason: "campus_pattern",
    };
  }

  const liveHits = LIVE_PATTERNS.filter((pattern) =>
    pattern.test(text)
  );

  if (liveHits.length > 0) {
    return {
      mode: AI_MODES.LIVE_INTERNET,
      tools: [],
      reason: "live_pattern",
    };
  }

  return {
    mode: AI_MODES.GENERAL,
    tools: [],
    reason: "default_general",
  };
};

export const detectCampusTools = (prompt) => {
  const text = sanitizePrompt(prompt);
  const tools = new Set();

  for (const [toolName, patterns] of Object.entries(CAMPUS_TOOL_HINTS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      tools.add(toolName);
    }
  }

  // Sensible defaults when campus mode is detected but no
  // specific tool matched — never open-ended DB access.
  if (tools.size === 0) {
    tools.add("getMyProfile");
    tools.add("getMyGroups");
    tools.add("getUnreadSummary");
  }

  return [...tools];
};

export const getStarterPrompts = (role) => {
  if (role === USER_ROLES.TEACHER) {
    return [
      "Draft an announcement for my students",
      "Show my students",
      "Explain a teaching topic simply",
      "Summarize department activity",
      "Show my groups",
    ];
  }

  if (role === USER_ROLES.ADMIN) {
    return [
      "Platform statistics",
      "Department summary",
      "Active users overview",
      "Teacher approvals summary",
      "Group summary",
    ];
  }

  return [
    "Explain a programming topic",
    "Show my groups",
    "Help write an assignment",
    "Summarize unread chats",
    "Career advice for my field",
  ];
};

export const getFollowUpSuggestions = (mode, role) => {
  if (mode === AI_MODES.CAMPUS) {
    const campus = [
      "Break down by year",
      "Show teachers",
      "Show groups",
      "Summarize",
    ];

    if (role === USER_ROLES.ADMIN) {
      campus.push("Show platform statistics");
    }

    return campus;
  }

  if (mode === AI_MODES.LIVE_INTERNET) {
    return [
      "Summarize key points",
      "Show sources again",
      "What changed recently?",
      "Explain simply",
    ];
  }

  return [
    "Explain with an example",
    "Show code",
    "Simplify",
    "Generate a quiz",
    "Summarize",
  ];
};

/**
 * Local autocomplete candidates (no network).
 */
export const LOCAL_AUTOCOMPLETE = Object.freeze([
  "Explain React Hooks",
  "Write Python code for",
  "Solve this maths problem",
  "Explain recursion",
  "Translate to English",
  "Fix this bug",
  "Write an email about",
  "Project ideas for",
  "Show my groups",
  "Show my teachers",
  "My department summary",
  "Summarize unread chats",
  "Latest AI news",
  "Weather today",
  "Platform statistics",
  "Draft an announcement",
]);

export const filterLocalSuggestions = (query, limit = 6) => {
  const q = sanitizePrompt(query, 120).toLowerCase();

  if (q.length < 2) {
    return [];
  }

  return LOCAL_AUTOCOMPLETE.filter((item) =>
    item.toLowerCase().includes(q)
  ).slice(0, limit);
};

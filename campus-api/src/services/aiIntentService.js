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

/**
 * Common misspellings / casual typing → canonical words for intent matching.
 */
const TYPO_WORD_MAP = Object.freeze({
  stundet: "student",
  stundent: "student",
  studnt: "student",
  studet: "student",
  studnets: "students",
  stuents: "students",
  stundets: "students",
  techer: "teacher",
  teachre: "teacher",
  teacers: "teachers",
  teache: "teacher",
  departmnt: "department",
  departmnet: "department",
  departmant: "department",
  depatment: "department",
  depsatment: "department",
  deptmnt: "department",
  deprtment: "department",
  naem: "name",
  nmae: "name",
  naems: "names",
  nam: "name",
  baci: "basic",
  basc: "basic",
  basci: "basic",
  inf: "info",
  infromation: "information",
  informtion: "information",
  detials: "details",
  deatils: "details",
  detaisl: "details",
  otehrs: "others",
  othr: "other",
  hwo: "how",
  hw: "how",
  whos: "who",
  whi: "who",
  wat: "what",
  wht: "what",
  whts: "what",
  mny: "many",
  mnay: "many",
  cout: "count",
  coun: "count",
  totl: "total",
  profle: "profile",
  proflie: "profile",
  yers: "years",
  yer: "year",
  grups: "groups",
  grup: "group",
  mesage: "message",
  mesages: "messages",
  unred: "unread",
  platfrm: "platform",
  statstics: "statistics",
  statisics: "statistics",
  assignd: "assigned",
  assined: "assigned",
  myslf: "myself",
  abot: "about",
  abuot: "about",
});

const CAMPUS_SIGNAL_GROUPS = Object.freeze({
  self: ["my", "mine", "me", "myself", "i", "am", "im"],
  profile: [
    "profile",
    "name",
    "names",
    "who",
    "about",
    "basic",
    "info",
    "information",
    "details",
    "role",
    "identity",
  ],
  students: ["student", "students", "learner", "learners"],
  teachers: ["teacher", "teachers", "faculty", "professor", "professors"],
  department: ["department", "dept", "departments"],
  year: ["year", "years", "semester", "semesters"],
  count: ["how", "many", "count", "total", "number", "much"],
  groups: ["group", "groups", "class", "classes"],
  platform: ["platform", "campus", "statistics", "stats", "overview"],
  unread: ["unread", "missed", "messages", "message", "chats", "chat"],
  list: ["show", "list", "get", "give", "tell", "fetch", "display", "see"],
});

const PHRASE_REPLACEMENTS = [
  [/\bdepts?\b/gi, "department"],
  [/\bdepsatment\b/gi, "department"],
  [/\bdepartmnet\b/gi, "department"],
  [/\bdepartmant\b/gi, "department"],
  [/\bdepatment\b/gi, "department"],
  [/\bwho\s+i\s*a+\s*m\b/gi, "who am i"],
  [/\bwho\s+im\s+i\b/gi, "who am i"],
  [/\bwho\s+i\s+am\b/gi, "who am i"],
  [/\bwhi\s+am\s+i\b/gi, "who am i"],
  [/\bmy\s+name\s+and\b/gi, "my name"],
  [/\bbasic\s+info\b/gi, "basic info profile"],
];

const tokenizeIntentText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const correctIntentToken = (token) => {
  const lower = token.toLowerCase();

  if (TYPO_WORD_MAP[lower]) {
    return TYPO_WORD_MAP[lower];
  }

  // Light fuzzy match for longer campus words (edit distance 1).
  if (lower.length >= 5) {
    for (const [typo, canonical] of Object.entries(TYPO_WORD_MAP)) {
      if (
        Math.abs(typo.length - lower.length) <= 1 &&
        (typo.startsWith(lower.slice(0, 3)) || lower.startsWith(typo.slice(0, 3)))
      ) {
        let mismatches = 0;
        const maxLen = Math.max(typo.length, lower.length);

        for (let index = 0; index < maxLen; index += 1) {
          if (typo[index] !== lower[index]) {
            mismatches += 1;
          }
        }

        if (mismatches <= 2) {
          return canonical;
        }
      }
    }
  }

  return lower;
};

const normalizeIntentText = (raw) => {
  let text = sanitizePrompt(raw).toLowerCase();

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return tokenizeIntentText(text).map(correctIntentToken).join(" ");
};

const collectCampusSignals = (normalizedText) => {
  const tokens = tokenizeIntentText(normalizedText);
  const tokenSet = new Set(tokens);
  const joined = ` ${tokens.join(" ")} `;
  const matched = new Set();

  for (const [group, keywords] of Object.entries(CAMPUS_SIGNAL_GROUPS)) {
    const hit = keywords.some(
      (keyword) =>
        tokenSet.has(keyword) ||
        joined.includes(` ${keyword} `) ||
        normalizedText.includes(keyword)
    );

    if (hit) {
      matched.add(group);
    }
  }

  let score = matched.size;

  if (matched.has("self")) {
    if (
      matched.has("profile") ||
      matched.has("students") ||
      matched.has("teachers") ||
      matched.has("department") ||
      matched.has("year") ||
      matched.has("count")
    ) {
      score += 2;
    }
  }

  if (matched.has("count") && matched.has("students")) {
    score += 1;
  }

  if (matched.has("list") && (matched.has("students") || matched.has("teachers"))) {
    score += 1;
  }

  if (matched.has("profile") && matched.has("self")) {
    score += 1;
  }

  return { score, matched };
};

const inferToolsFromSignals = (matched) => {
  const tools = new Set();

  if (
    matched.has("profile") ||
    matched.has("department") ||
    matched.has("year") ||
    (matched.has("self") && matched.has("count"))
  ) {
    tools.add("getMyProfile");
    tools.add("getDepartmentSummary");
    tools.add("getYearSummary");
  }

  if (matched.has("students") || matched.has("teachers")) {
    tools.add("searchAuthorizedUsers");
  }

  if (matched.has("count") && matched.has("students")) {
    tools.add("getDepartmentSummary");
    tools.add("getYearSummary");
  }

  if (matched.has("groups")) {
    tools.add("getMyGroups");
  }

  if (matched.has("unread")) {
    tools.add("getUnreadSummary");
  }

  if (matched.has("platform")) {
    tools.add("getPlatformSummary");
  }

  if (tools.size === 0 && matched.has("self")) {
    tools.add("getMyProfile");
    tools.add("getDepartmentSummary");
    tools.add("getYearSummary");
  }

  return [...tools];
};

const CAMPUS_KEYWORD_SCORE_THRESHOLD = 3;

const CAMPUS_PATTERNS = [
  /\bmy (groups?|teachers?|students?|department|profile|year|unread)\b/i,
  /\b(show|list|get|how many|total|count|summary of)\b.*\b(groups?|students?|teachers?|departments?|users?|unread)\b/i,
  /\bstudents in my (year|department|class)\b/i,
  /\b(assigned students|search student|platform statistics|active users)\b/i,
  /\b(department|group|year) (summary|statistics|stats)\b/i,
  /\bwho (are|is) my (teachers?|students?)\b/i,
  /\bcampus(connect)?\b.*\b(data|stats|summary)\b/i,
  // Self profile / department / year questions
  /\b(which|what)\s+(department|dept|year|years)\b/i,
  /\b(department|dept|year|years)\b.*\b(i am|am i|mine)\b/i,
  /\b(i am|am i)\b.*\b(department|dept|year|years)\b/i,
  /\bwho am i\b/i,
  /\bwhat('s| is) my name\b/i,
  /\btell me about myself\b/i,
  /\bmy (department|dept|year|profile|details|info|teaching)\b/i,
  /\bteaching years?\b/i,
];

const CAMPUS_TOOL_HINTS = Object.freeze({
  getMyProfile: [
    /\bmy profile\b/i,
    /\babout me\b/i,
    /\bwho am i\b/i,
    /\bwhat('s| is) my name\b/i,
    /\bmy name\b/i,
    /\b(which|what)\s+(department|dept|year|years)\b/i,
    /\b(department|dept|year)\b.*\b(i am|am i)\b/i,
    /\b(i am|am i)\b.*\b(department|dept|year)\b/i,
    /\bmy (department|dept|year|details|info|role|name)\b/i,
  ],
  getMyGroups: [/\bmy groups?\b/i, /\bgroups? i('m| am) in\b/i],
  getDepartmentSummary: [
    /\b(my|mine)\b.*\bdepartment\b/i,
    /\bdepartment\b.*\b(mine|my)\b/i,
    /\bwhat('s| is)\s+my\s+department\b/i,
    /\b(my )?department\b/i,
    /\bdepartment (summary|stats|statistics)\b/i,
    /\bhow many\b.*\b(students?|teachers?)\b/i,
    /\b(students?|teachers?) in (my )?department\b/i,
  ],
  getYearSummary: [
    /\bmy year\b/i,
    /\b(which|what)\s+year\b/i,
    /\byear\b.*\b(i am|am i)\b/i,
    /\b(i am|am i)\b.*\byear\b/i,
    /\byear (summary|stats)\b/i,
    /\bstudents in my year\b/i,
    /\bteaching years?\b/i,
    /\bhow many\b.*\bstudents?\b/i,
  ],
  searchAuthorizedUsers: [
    /\bsearch (student|teacher|user)\b/i,
    /\bfind (a )?student\b/i,
    /\bmy teachers?\b/i,
    /\bmy (assigned )?students?\b/i,
    /\b(show|list|get|name)\b.*\b(students?|teachers?)\b/i,
    /\b(students?|teachers?) (names?|list)\b/i,
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
    /\bhow many\b.*\b(students?|teachers?|users?|admins?)\b/i,
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
  const text = normalizeIntentText(prompt);

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

  const { score, matched } = collectCampusSignals(text);

  if (score >= CAMPUS_KEYWORD_SCORE_THRESHOLD) {
    const tools = inferToolsFromSignals(matched);

    return {
      mode: AI_MODES.CAMPUS,
      tools: tools.length ? tools : detectCampusTools(text),
      reason: "campus_keywords",
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
  const text = normalizeIntentText(prompt);
  const tools = new Set();

  for (const [toolName, patterns] of Object.entries(CAMPUS_TOOL_HINTS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      tools.add(toolName);
    }
  }

  // Profile / department / year questions need the full self-service bundle.
  if (
    tools.has("getMyProfile") ||
    tools.has("getDepartmentSummary") ||
    tools.has("getYearSummary")
  ) {
    tools.add("getMyProfile");
    tools.add("getDepartmentSummary");
    tools.add("getYearSummary");
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

/**
 * Infer tool arguments from the user prompt (e.g. student vs teacher list).
 */
export const buildToolArgsFromPrompt = (prompt, toolNames = []) => {
  const text = normalizeIntentText(prompt);
  const argsByTool = {};
  const tools = new Set(toolNames);
  const { matched } = collectCampusSignals(text);

  if (tools.has("searchAuthorizedUsers")) {
    if (
      matched.has("students") ||
      /\bmy (assigned )?students?\b/i.test(text) ||
      /\b(show|list|get|name|give|tell)\b.*\bstudents?\b/i.test(text) ||
      /\bstudents? (names?|list)\b/i.test(text)
    ) {
      argsByTool.searchAuthorizedUsers = { role: "student" };
    } else if (
      matched.has("teachers") ||
      /\bmy teachers?\b/i.test(text) ||
      /\b(show|list|get)\b.*\bteachers?\b/i.test(text)
    ) {
      argsByTool.searchAuthorizedUsers = { role: "teacher" };
    }
  }

  return argsByTool;
};

export const getStarterPrompts = (role) => {
  if (role === USER_ROLES.TEACHER) {
    return [
      "Which department am I in?",
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

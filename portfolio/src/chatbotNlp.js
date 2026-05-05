/**
 * Lightweight pre-LLM query analysis: segmentation, synonym expansion, weighted
 * token and bigram scoring for local index retrieval and answer extraction.
 */

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "as",
  "by",
  "at",
  "from",
  "or",
  "and",
  "but",
  "if",
  "then",
  "so",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "my",
  "your",
  "yours",
  "what",
  "which",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "how",
  "why",
  "when",
  "where",
  "there",
  "here",
  "about",
  "into",
  "any",
  "some",
  "can",
  "could",
  "would",
  "should",
  "tell",
  "please",
  "just",
  "like",
  "want",
  "know",
  "get",
  "got",
  "give",
  "gave",
]);

const SYNONYMS = {
  cv: ["resume", "profile", "summary"],
  resume: ["cv", "profile", "summary"],
  profile: ["resume", "summary"],
  stack: ["skills", "tools", "technologies", "tech"],
  tech: ["technologies", "tools", "stack"],
  tooling: ["tools", "stack"],
  langs: ["languages", "programming"],
  languages: ["python", "sql", "programming"],
  etl: ["pipeline", "pipelines", "data"],
  elt: ["pipeline", "data"],
  viz: ["visualization", "dashboard", "tableau"],
  visualization: ["dashboard", "tableau"],
  ml: ["machine", "learning", "model", "models"],
  ai: ["machine", "learning", "model"],
  database: ["databases", "sql"],
  databases: ["sql", "mongodb", "postgresql", "mysql"],
  degree: ["education", "college", "university"],
  school: ["university", "college", "education"],
  role: ["position", "job", "work"],
  position: ["role", "job"],
  hire: ["contact", "reach", "email"],
  hiring: ["contact", "work"],
  reach: ["contact", "email"],
  repo: ["github", "project", "projects"],
  repos: ["github", "project"],
  code: ["github", "python", "programming"],
  background: ["experience", "career", "summary"],
  worked: ["experience", "work"],
  working: ["experience", "work"],
  analytics: ["analysis", "data", "tableau"],
  analyst: ["analysis", "data", "sql"],
  engineer: ["engineering", "data", "software"],
  engineering: ["engineer", "data", "systems"],
};

const PHRASE_BIGRAM_SOURCES = [
  "power bi",
  "machine learning",
  "data science",
  "data engineering",
  "business intelligence",
  "deep learning",
  "large language",
];

const SKILL_PHRASES = [
  "power bi",
  "machine learning",
  "data engineering",
  "data science",
  "postgresql",
  "postgres",
  "mongodb",
  "mysql",
  "tableau",
  "fastapi",
  "kubernetes",
  "terraform",
  "snowflake",
  "databricks",
  "bigquery",
  "pytorch",
  "tensorflow",
  "javascript",
  "typescript",
  "react",
  "pandas",
  "numpy",
  "scikit-learn",
  "sklearn",
  "aws",
  "gcp",
  "azure",
  "sql",
  "python",
];

export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

export function segmentQuery(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const pieces = [];
  for (const block of text.split(/[\n;|]+/)) {
    const b = block.trim();
    if (!b) continue;
    for (const part of b.split(/\s+(?:and|&)\s+/i)) {
      const p = part.trim();
      if (p) pieces.push(p);
    }
  }
  return pieces.length ? pieces : [text];
}

function filteredScoringTokens(segment) {
  return tokenize(segment).filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

export function buildWeightedTerms(query) {
  const collected = new Map();
  const segments = segmentQuery(query);
  const toScan = segments.length ? segments : [String(query || "").trim()].filter(Boolean);

  for (const segment of toScan) {
    for (const tok of filteredScoringTokens(segment)) {
      collected.set(tok, Math.max(collected.get(tok) || 0, 1));
      const syns = SYNONYMS[tok];
      if (syns) {
        for (const syn of syns) {
          if (STOPWORDS.has(syn) || syn.length <= 1) continue;
          collected.set(syn, Math.max(collected.get(syn) || 0, 0.38));
        }
      }
    }
  }
  if (!collected.size) {
    for (const tok of tokenize(query)) {
      if (tok.length > 0) collected.set(tok, Math.max(collected.get(tok) || 0, 0.55));
    }
  }
  return Array.from(collected.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function bigramsFromTokens(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push([tokens[i], tokens[i + 1]]);
  }
  return out;
}

function phraseAnchorBigrams(query) {
  const q = String(query || "").toLowerCase();
  const found = new Set();
  for (const phrase of PHRASE_BIGRAM_SOURCES) {
    if (q.includes(phrase)) {
      const parts = phrase.split(/\s+/);
      if (parts.length === 2) found.add(`${parts[0]}\t${parts[1]}`);
    }
  }
  return found;
}

function bigramKey(a, b) {
  return `${a}\t${b}`;
}

export function analyzeQuery(query) {
  const segments = segmentQuery(query);
  const segList = segments.length ? segments : [String(query || "").trim()].filter(Boolean);
  const weightedTerms = buildWeightedTerms(query);

  const stream = [];
  for (const seg of segList) {
    stream.push(...filteredScoringTokens(seg));
  }

  const bigramSet = new Set();
  for (const [a, b] of bigramsFromTokens(stream)) {
    bigramSet.add(bigramKey(a, b));
  }
  for (const k of phraseAnchorBigrams(query)) {
    bigramSet.add(k);
  }

  const intentTokens = new Set(tokenize(query));
  for (const tok of tokenize(query)) {
    if (STOPWORDS.has(tok)) continue;
    const syns = SYNONYMS[tok];
    if (syns) for (const syn of syns) intentTokens.add(syn);
  }

  return { segments: segList, weightedTerms, bigramSet, intentTokens };
}

export function detectIntentFromSignals(signals) {
  const tokenSet = signals.intentTokens;
  const has = (terms) => terms.some((term) => tokenSet.has(term));
  if (has(["sql", "python", "skills", "skill", "tools", "stack", "technologies", "tech"])) return "skills";
  if (has(["experience", "years", "worked", "background", "career", "work", "role", "position", "job"]))
    return "experience";
  if (has(["project", "projects", "built", "build", "repo", "repos"])) return "projects";
  if (has(["education", "degree", "college", "university", "school"])) return "education";
  if (has(["contact", "email", "linkedin", "github", "reach", "hire", "hiring"])) return "contact";
  return "general";
}

export function intentBoost(chunk, intent) {
  const section = String(chunk?.section || "").toLowerCase();
  const doc = String(chunk?.doc_id || "").toLowerCase();
  const title = String(chunk?.title || "").toLowerCase();
  const text = `${section} ${doc} ${title}`;
  const intentTerms = {
    skills: ["skill", "tools", "stack", "sql", "python", "technologies"],
    experience: ["experience", "summary", "work", "years"],
    projects: ["project"],
    education: ["education", "college", "degree"],
    contact: ["contact", "email", "linkedin", "github"],
    general: [],
  };
  const terms = intentTerms[intent] || [];
  return terms.some((term) => text.includes(term)) ? 2 : 0;
}

function lexicalMatchScore(chunkText, signals) {
  const tokens = tokenize(chunkText);
  if (!tokens.length) return 0;
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  let score = 0;
  for (const [term, w] of signals.weightedTerms) {
    score += w * (counts.get(term) || 0);
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const k = bigramKey(tokens[i], tokens[i + 1]);
    if (signals.bigramSet.has(k)) score += 2.35;
  }
  return score;
}

export function scoreChunk(signals, chunkText) {
  return lexicalMatchScore(chunkText, signals);
}

export function searchIndex(index, question, topK = 3) {
  const signals = analyzeQuery(question);
  const intent = detectIntentFromSignals(signals);
  return (Array.isArray(index) ? index : [])
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(signals, String(chunk?.text || "")) + intentBoost(chunk, intent),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function extractBestSentences(text, signals, maxSentences = 2) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) return [];

  const scored = sentences
    .map((sentence) => ({ sentence, score: lexicalMatchScore(sentence, signals) }))
    .sort((a, b) => b.score - a.score);

  const picked = scored.filter((item) => item.score > 0).slice(0, maxSentences);
  if (picked.length) return picked.map((item) => item.sentence);
  return sentences.slice(0, maxSentences);
}

export function detectSkillEntity(question) {
  const q = String(question || "").toLowerCase();
  for (const item of SKILL_PHRASES) {
    if (q.includes(item)) return item;
  }
  return "";
}

export function extractYearsValue(text) {
  const normalized = String(text || "");
  const match = normalized.match(/(\d+\+?)\s+years?/i);
  return match ? match[1] : "";
}

export function buildTailoredAnswer(results, question) {
  const signals = analyzeQuery(question);
  const intent = detectIntentFromSignals(signals);
  const queryTokens = tokenize(question);
  const asksYears = queryTokens.includes("years") || queryTokens.includes("year");
  const skillEntity = detectSkillEntity(question);
  const top = results[0];
  const second = results[1];

  const lines = extractBestSentences(String(top?.text || ""), signals, 2);
  if (lines.length < 2 && second?.text) {
    const extra = extractBestSentences(String(second.text), signals, 1);
    if (extra.length) lines.push(extra[0]);
  }
  const concise = lines.join(" ").slice(0, 320).trim();
  const yearsValue = extractYearsValue(`${top?.text || ""} ${second?.text || ""}`);

  if (asksYears && skillEntity && yearsValue) {
    const techLabel = skillEntity.toUpperCase() === "aws" ? "AWS" : skillEntity.toUpperCase();
    const evidence = concise || "my portfolio highlights applied experience across projects and workflows.";
    return `I have about ${yearsValue} years of experience working with ${techLabel}. ${evidence}`.trim();
  }

  const prefixByIntent = {
    skills: "Based on my profile,",
    experience: "Based on my experience,",
    projects: "Based on my projects,",
    education: "From my education background,",
    contact: "You can reach me via the details in my profile,",
    general: "Here is what matches your question,",
  };
  const prefix = prefixByIntent[intent] || prefixByIntent.general;
  return `${prefix} ${concise || "I could not extract a concise answer, but I found related information."}`.trim();
}

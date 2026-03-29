/**
 * Builds workflow-selected site JSON, PDF public copy, and runtime metadata.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(PORTFOLIO_ROOT, "..");

function readJsonObject(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error("Missing:", filePath);
    process.exit(1);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("expected object JSON");
    }
    return parsed;
  } catch (e) {
    console.error(`Invalid JSON at ${filePath}:`, e.message);
    process.exit(1);
  }
}

function resolveWorkflow() {
  const workflowPath = path.join(REPO_ROOT, "config", "workflow.active.json");
  const cfg = readJsonObject(workflowPath);
  const required = [
    "resume_content_id",
    "portfolio_content_id",
    "portfolio_format_id",
    "outputs",
  ];
  for (const key of required) {
    if (!(key in cfg)) {
      console.error(`workflow.active.json missing key: ${key}`);
      process.exit(1);
    }
  }
  if (!cfg.outputs || typeof cfg.outputs !== "object" || Array.isArray(cfg.outputs)) {
    console.error("workflow.active.json outputs must be an object");
    process.exit(1);
  }
  for (const key of ["site_json", "resume_pdf", "build_manifest"]) {
    if (!cfg.outputs[key] || typeof cfg.outputs[key] !== "string") {
      console.error(`workflow.active.json outputs.${key} must be a non-empty string`);
      process.exit(1);
    }
  }
  return {
    config: cfg,
    resumeMd: path.join(REPO_ROOT, "content", "resumes", `${cfg.resume_content_id}.md`),
    portfolioMd: path.join(
      REPO_ROOT,
      "content",
      "portfolios",
      `${cfg.portfolio_content_id}.md`,
    ),
    portfolioFormat: path.join(
      REPO_ROOT,
      "templates",
      "portfolio_formats",
      `${cfg.portfolio_format_id}.json`,
    ),
    outSite: path.join(PORTFOLIO_ROOT, "public", cfg.outputs.site_json),
    pdfSrc: path.join(REPO_ROOT, "artifacts", cfg.outputs.resume_pdf),
    pdfOut: path.join(PORTFOLIO_ROOT, "public", cfg.outputs.resume_pdf),
    buildManifest: path.join(REPO_ROOT, "artifacts", cfg.outputs.build_manifest),
  };
}

const WORKFLOW = resolveWorkflow();
const PORTFOLIO_FORMAT = readJsonObject(WORKFLOW.portfolioFormat);
const MD_RESUME = WORKFLOW.resumeMd;
const MD_PORTFOLIO = WORKFLOW.portfolioMd;
const OUT_SITE = WORKFLOW.outSite;
const PDF_SRC = WORKFLOW.pdfSrc;
const PDF_OUT = WORKFLOW.pdfOut;
const RUNTIME_OUT = path.join(PORTFOLIO_ROOT, "public", "workflow.runtime.json");

function parseContactLine(line) {
  const contact = {
    phone: "",
    email: { text: "", href: "" },
    linkedin: { text: "", href: "" },
    github: { text: "", href: "" },
    portfolio: { text: "", href: "" },
  };
  const segments = line.split("|").map((s) => s.trim());
  for (const seg of segments) {
    const md = seg.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (md) {
      const lower = md[1].toLowerCase();
      if (lower.includes("mail")) {
        contact.email = { text: md[1], href: md[2] };
      } else if (lower.includes("linkedin")) {
        contact.linkedin = { text: md[1], href: md[2] };
      } else if (lower.includes("github")) {
        contact.github = { text: md[1], href: md[2] };
      } else if (lower.includes("portfolio")) {
        contact.portfolio = { text: md[1], href: md[2] };
      }
    } else if (seg.length > 0 && !seg.startsWith("[")) {
      contact.phone = contact.phone ? `${contact.phone} | ${seg}` : seg;
    }
  }
  return contact;
}

/** GitHub login from resume contact line (profile or org root URL only). */
function githubUsernameFromResumeContact(contact) {
  const href = contact?.github?.href;
  if (!href || typeof href !== "string" || !href.trim()) return "";
  let u;
  try {
    const raw = href.trim();
    u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return "";
  }
  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "github.com") return "";
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 1) return "";
  const firstSeg = parts[0];
  if (firstSeg === "orgs" || firstSeg === "enterprise" || firstSeg === "settings")
    return "";
  const user = firstSeg;
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(user)) return "";
  return user;
}

/**
 * Resolve current avatar via GitHub API + cache-buster so new profile photos
 * show after redeploy without stale browser/CDN copies of avatars.githubusercontent.com.
 */
async function fetchGitHubAvatarForContact(contact) {
  const user = githubUsernameFromResumeContact(contact);
  if (!user) return "";
  const fallback = `https://github.com/${user}.png`;
  try {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(user)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "personal-info-portfolio-sync",
        },
      },
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    const raw = data?.avatar_url;
    if (typeof raw !== "string" || !raw.trim()) return fallback;
    const base = raw.trim();
    const cb = Date.now();
    return `${base}${base.includes("?") ? "&" : "?"}cb=${cb}`;
  } catch {
    return fallback;
  }
}

function extractResumeSections(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const name = (lines[0] || "").replace(/^#\s*/, "").trim();
  let ci = 1;
  while (ci < lines.length && !lines[ci].trim()) {
    ci += 1;
  }
  const contactLine = (lines[ci] || "").trim();
  const map = {};
  const re = /^## (.+)$/gm;
  let m;
  const hits = [];
  while ((m = re.exec(normalized)) !== null) {
    hits.push({
      title: m[1].trim(),
      index: m.index,
      contentStart: m.index + m[0].length,
    });
  }
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].contentStart;
    const end = i + 1 < hits.length ? hits[i + 1].index : normalized.length;
    let body = normalized.slice(start, end).trim();
    body = body.replace(/^---+[\s\n]*/gm, "").trim();
    map[hits[i].title] = body;
  }
  return { name, contactLine, sections: map };
}

/** Matches **left** | middle | right (used for role/org line and compact project rows). */
const TRIPLE_META_LINE =
  /^\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$/;

function parseTripleMetaLine(line) {
  const m = line.trim().match(TRIPLE_META_LINE);
  if (!m) return null;
  return { left: m[1].trim(), middle: m[2].trim(), right: m[3].trim() };
}

function collectBulletsFrom(lines, startIndex) {
  const bullets = [];
  for (let i = startIndex; i < lines.length; i++) {
    const raw = lines[i];
    const ln = typeof raw === "string" ? raw.trim() : "";
    if (ln.startsWith("- ")) bullets.push(ln.slice(2).trim());
  }
  return bullets;
}

/** Split lines where a new full-line **a** | b | c row begins (stacked compact projects). */
const COMPACT_STACK_SPLIT =
  /(?=^\*\*.+?\*\*\s*\|\s*.+?\s*\|\s*.+?\s*$)/m;

/**
 * If chunk starts with a compact triple-meta row, split into one sub-chunk per such row
 * (multiple projects back-to-back without ###). Classic chunks (plain title first) unchanged.
 */
function subsplitCompactStacks(chunk) {
  const t = chunk.trim();
  if (!t) return [];
  const firstLine = t.split("\n")[0].trim().replace(/^#+\s*/, "");
  if (!parseTripleMetaLine(firstLine)) {
    return [t];
  }
  return t
    .split(COMPACT_STACK_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Splits on ### job/project headings. Supports:
 * - Classic: title line, then **Company** | Location | Dates, then bullets
 * - Compact: first line **Name** | Subtitle/stack | Year (no ###), then bullets (optional blank lines)
 * - Stacked compact: several **Name** | ... | Year blocks in one section, separated by blank lines
 */
function parseExperience(body) {
  const jobs = [];
  let normalized = body.trim();
  if (normalized.startsWith("### ")) {
    normalized = normalized.slice(4);
  }
  const parts = normalized.split(/\n### /);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const stacks = subsplitCompactStacks(trimmed);
    for (const chunk of stacks) {
      const lines = chunk.split("\n");
      const firstLine = lines[0].trim().replace(/^#+\s*/, "");
      const tripleOnFirst = parseTripleMetaLine(firstLine);
      const secondTrim = (lines[1] || "").trim();

      if (
        tripleOnFirst &&
        (lines.length === 1 ||
          secondTrim === "" ||
          secondTrim.startsWith("-"))
      ) {
        jobs.push({
          title: tripleOnFirst.left,
          company: tripleOnFirst.middle,
          location: "",
          dates: tripleOnFirst.right,
          bullets: collectBulletsFrom(lines, 1),
        });
        continue;
      }

      const title = firstLine;
      const metaLine = secondTrim;
      const metaMatch = metaLine.match(TRIPLE_META_LINE);
      const company = metaMatch ? metaMatch[1].trim() : "";
      const location = metaMatch ? metaMatch[2].trim() : "";
      const dates = metaMatch ? metaMatch[3].trim() : "";
      jobs.push({
        title,
        company,
        location,
        dates,
        bullets: collectBulletsFrom(lines, 2),
      });
    }
  }
  return jobs;
}

function parseEducation(body) {
  const rows = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*@edu\s+(.+)$/i);
    if (!m) continue;
    const pts = m[1].split("|").map((s) => s.trim());
    rows.push({
      school: pts[0] || "",
      detail: pts[1] || "",
      year: pts[2] || "",
    });
  }
  return rows;
}

function parseTech(body) {
  const rows = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*@tech\s+(.+)$/i);
    if (!m) continue;
    const pts = m[1].split("|").map((s) => s.trim());
    rows.push({ label: pts[0] || "", value: pts[1] || "" });
  }
  return rows;
}

const PORTFOLIO_SECTION_KEYS = {
  "about me": "aboutMe",
  "let's connect": "letsConnect",
  "lets connect": "letsConnect",
  "what i do best": "whatIDoBest",
  "impact at a glance": "impactAtAGlance",
  "impact metrics": "impactAtAGlance",
};

if (
  PORTFOLIO_FORMAT.section_mapping &&
  typeof PORTFOLIO_FORMAT.section_mapping === "object" &&
  !Array.isArray(PORTFOLIO_FORMAT.section_mapping)
) {
  for (const [heading, key] of Object.entries(PORTFOLIO_FORMAT.section_mapping)) {
    if (
      typeof heading === "string" &&
      heading.trim() &&
      typeof key === "string" &&
      key.trim()
    ) {
      PORTFOLIO_SECTION_KEYS[heading.trim().toLowerCase()] = key.trim();
    }
  }
}

/** Defaults when frontmatter is missing or keys are omitted. */
const DEFAULT_PORTFOLIO_UI = {
  heroTagline:
    "Hi, I'm {{firstName}}. I'm an analyst by profession, engineer by education, human by nature.",
  eyebrow: "Portfolio",
  metaTitleSuffix: "Portfolio",
  pdfButton: "Download PDF resume",
  aboutMeHeading: "About me",
  whatIDoBestHeading: "What I do best",
  impactAtAGlanceHeading: "Impact at a glance",
  workHighlightsHeading: "Work highlights",
  workHighlightsLede: "",
  projectsHeading: "Projects",
  educationHeading: "Education",
  toolsAndStackHeading: "Tools and stack",
  twoColAriaLabel: "Education and tools",
  letsConnectHeading: "Let's connect",
  footerNote: "",
  photoProjectsDelivered: "15+",
  photoProjectsDeliveredDescription: "",
  /** Full https URL or site-relative path under portfolio/public (e.g. headshot.jpg). Empty = App fallback. */
  profilePhotoUrl: "",
};

if (
  PORTFOLIO_FORMAT.ui_defaults &&
  typeof PORTFOLIO_FORMAT.ui_defaults === "object" &&
  !Array.isArray(PORTFOLIO_FORMAT.ui_defaults)
) {
  for (const [key, value] of Object.entries(PORTFOLIO_FORMAT.ui_defaults)) {
    if (typeof value === "string" && value.trim()) {
      DEFAULT_PORTFOLIO_UI[key] = value.trim();
    }
  }
}

function splitPortfolioFrontmatter(raw) {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: {}, body: normalized };
  }
  const close = normalized.indexOf("\n---\n", 4);
  if (close === -1) {
    console.error(
      "portfolio.md: starts with --- but no closing ---\\n before body",
    );
    process.exit(1);
  }
  const yamlBlock = normalized.slice(4, close);
  const body = normalized.slice(close + 5);
  let data = {};
  try {
    data = parseYaml(yamlBlock);
    if (data == null || typeof data !== "object" || Array.isArray(data)) {
      data = {};
    }
  } catch (e) {
    console.error("portfolio.md frontmatter YAML error:", e.message);
    process.exit(1);
  }
  return { frontmatter: data, body };
}

function substituteFirstName(s, firstName) {
  return String(s).replace(/\{\{firstName\}\}/g, firstName);
}

const PORTFOLIO_UI_KEYS = Object.keys(DEFAULT_PORTFOLIO_UI);

function buildPortfolioUi(frontmatter, firstName) {
  const merged = { ...DEFAULT_PORTFOLIO_UI };
  for (const key of PORTFOLIO_UI_KEYS) {
    if (
      Object.prototype.hasOwnProperty.call(frontmatter, key) &&
      frontmatter[key] != null &&
      String(frontmatter[key]).trim() !== ""
    ) {
      merged[key] = String(frontmatter[key]).trim();
    }
  }
  merged.heroTagline = substituteFirstName(merged.heroTagline, firstName);
  return merged;
}

function extractPortfolioSections(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const map = {};
  const re = /^## (.+)$/gm;
  const hits = [];
  let m;
  while ((m = re.exec(normalized)) !== null) {
    hits.push({
      title: m[1].trim(),
      index: m.index,
      contentStart: m.index + m[0].length,
    });
  }
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].contentStart;
    const end = i + 1 < hits.length ? hits[i + 1].index : normalized.length;
    let body = normalized.slice(start, end).trim();
    body = body.replace(/^---+[\s\n]*/gm, "").trim();
    const keyRaw = hits[i].title.trim().toLowerCase();
    const key =
      PORTFOLIO_SECTION_KEYS[keyRaw] ||
      hits[i].title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    map[key] = body;
  }
  return map;
}

function parsePortfolioMdFile() {
  if (!fs.existsSync(MD_PORTFOLIO)) {
    return { portfolio: {}, frontmatter: {} };
  }
  const raw = fs.readFileSync(MD_PORTFOLIO, "utf8");
  const { frontmatter, body } = splitPortfolioFrontmatter(raw);
  const portfolio = extractPortfolioSections(body);
  return { portfolio, frontmatter };
}

async function main() {
  if (!fs.existsSync(MD_RESUME)) {
    console.error("Missing:", MD_RESUME);
    process.exit(1);
  }
  const rawResume = fs.readFileSync(MD_RESUME, "utf8");
  const { name, contactLine, sections } = extractResumeSections(rawResume);
  const summary = (sections["Professional Summary"] || "")
    .replace(/\n+/g, " ")
    .trim();
  const experienceRaw = parseExperience(
    sections["Professional Experience"] || "",
  );
  const experience = experienceRaw.map((j) => ({
    ...j,
    displayTitle: j.title,
  }));
  const projectsRaw = parseExperience(sections["Projects"] || "");
  const projects = projectsRaw.map((j) => ({
    ...j,
    displayTitle: j.title,
  }));
  const education = parseEducation(sections["Education"] || "");
  const skills = parseTech(sections["Technical Skills"] || "");
  const first = name.split(/\s+/)[0] || name;
  const contact = parseContactLine(contactLine);

  const { portfolio, frontmatter } = parsePortfolioMdFile();
  const ui = buildPortfolioUi(frontmatter, first);
  if (!String(ui.profilePhotoUrl || "").trim()) {
    const inferred = await fetchGitHubAvatarForContact(contact);
    if (inferred) ui.profilePhotoUrl = inferred;
  }

  const site = {
    meta: {
      title: `${name} | ${ui.metaTitleSuffix}`,
      description: summary.slice(0, 160),
    },
    name,
    ui,
    contact,
    summary,
    portfolio,
    experience,
    projects,
    education,
    skills,
    pdfAvailable: fs.existsSync(PDF_SRC),
  };

  fs.mkdirSync(path.dirname(OUT_SITE), { recursive: true });
  fs.writeFileSync(OUT_SITE, JSON.stringify(site, null, 2), "utf8");
  console.log("Wrote", path.relative(PORTFOLIO_ROOT, OUT_SITE));

  if (fs.existsSync(PDF_SRC)) {
    fs.copyFileSync(PDF_SRC, PDF_OUT);
    console.log("Copied", path.relative(PORTFOLIO_ROOT, PDF_OUT));
  }

  const runtime = {
    profile_id: String(WORKFLOW.config.profile_id || ""),
    site_json_file: path.basename(OUT_SITE),
    resume_pdf_file: path.basename(PDF_OUT),
    generated_at_utc: new Date().toISOString(),
    selected: {
      resume_content_id: String(WORKFLOW.config.resume_content_id || ""),
      portfolio_content_id: String(WORKFLOW.config.portfolio_content_id || ""),
      resume_format_id: String(WORKFLOW.config.resume_format_id || ""),
      portfolio_format_id: String(WORKFLOW.config.portfolio_format_id || ""),
    },
  };
  fs.writeFileSync(RUNTIME_OUT, JSON.stringify(runtime, null, 2), "utf8");
  console.log("Wrote", path.relative(PORTFOLIO_ROOT, RUNTIME_OUT));

  const manifest = {
    profile_id: String(WORKFLOW.config.profile_id || ""),
    generated_at_utc: new Date().toISOString(),
    selected: {
      resume_content_id: String(WORKFLOW.config.resume_content_id || ""),
      portfolio_content_id: String(WORKFLOW.config.portfolio_content_id || ""),
      resume_format_id: String(WORKFLOW.config.resume_format_id || ""),
      portfolio_format_id: String(WORKFLOW.config.portfolio_format_id || ""),
    },
    outputs: {
      site_json: OUT_SITE,
      runtime_json: RUNTIME_OUT,
      resume_pdf_public: PDF_OUT,
      resume_pdf_source: PDF_SRC,
    },
  };
  fs.mkdirSync(path.dirname(WORKFLOW.buildManifest), { recursive: true });
  fs.writeFileSync(
    WORKFLOW.buildManifest,
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  console.log("Wrote", path.relative(REPO_ROOT, WORKFLOW.buildManifest));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Builds public/site.json from content/resume.md + content/portfolio.md.
 * Copies resume.pdf when present.
 * Optional YAML frontmatter in portfolio.md controls ui labels and hero tagline.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTFOLIO_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(PORTFOLIO_ROOT, "..");

const MD_RESUME = path.join(REPO_ROOT, "content", "resume.md");
const MD_PORTFOLIO = path.join(REPO_ROOT, "content", "portfolio.md");
const OUT_SITE = path.join(PORTFOLIO_ROOT, "public", "site.json");
const PDF_SRC = path.join(REPO_ROOT, "artifacts", "resume.pdf");
const PDF_OUT = path.join(PORTFOLIO_ROOT, "public", "resume.pdf");

function parseContactLine(line) {
  const contact = {
    phone: "",
    email: { text: "", href: "" },
    linkedin: { text: "", href: "" },
    github: { text: "", href: "" },
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
      }
    } else if (seg.length > 0 && !seg.startsWith("[")) {
      contact.phone = contact.phone ? `${contact.phone} | ${seg}` : seg;
    }
  }
  return contact;
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

/**
 * First job often starts with ### at column 0, so split(/\n### /) leaves "### Title" in chunk[0].
 */
function parseExperience(body) {
  const jobs = [];
  let normalized = body.trim();
  if (normalized.startsWith("### ")) {
    normalized = normalized.slice(4);
  }
  const parts = normalized.split(/\n### /);
  for (const part of parts) {
    const chunk = part.trim();
    if (!chunk) continue;
    const lines = chunk.split("\n");
    const title = lines[0].trim().replace(/^#+\s*/, "");
    const metaLine = (lines[1] || "").trim();
    const metaMatch = metaLine.match(
      /^\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*(.+)$/,
    );
    const company = metaMatch ? metaMatch[1].trim() : "";
    const location = metaMatch ? metaMatch[2].trim() : "";
    const dates = metaMatch ? metaMatch[3].trim() : "";
    const bullets = [];
    for (let i = 2; i < lines.length; i++) {
      const ln = lines[i];
      if (ln.startsWith("- ")) bullets.push(ln.slice(2).trim());
    }
    jobs.push({ title, company, location, dates, bullets });
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
  workHighlightsLede:
    "Roles and outcomes from your resume, in a portfolio layout.",
  educationHeading: "Education",
  toolsAndStackHeading: "Tools and stack",
  twoColAriaLabel: "Education and tools",
  letsConnectHeading: "Let's connect",
  footerNote:
    "Source: `content/resume.md` + `content/portfolio.md` - Run `npm run sync` after edits",
};

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

function main() {
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
  const education = parseEducation(sections["Education"] || "");
  const skills = parseTech(sections["Technical Skills"] || "");
  const first = name.split(/\s+/)[0] || name;

  const { portfolio, frontmatter } = parsePortfolioMdFile();
  const ui = buildPortfolioUi(frontmatter, first);

  const site = {
    meta: {
      title: `${name} | ${ui.metaTitleSuffix}`,
      description: summary.slice(0, 160),
    },
    name,
    ui,
    contact: parseContactLine(contactLine),
    summary,
    portfolio,
    experience,
    education,
    skills,
    pdfAvailable: fs.existsSync(PDF_SRC),
  };

  fs.mkdirSync(path.dirname(OUT_SITE), { recursive: true });
  fs.writeFileSync(OUT_SITE, JSON.stringify(site, null, 2), "utf8");
  console.log("Wrote", path.relative(PORTFOLIO_ROOT, OUT_SITE));

  if (fs.existsSync(PDF_SRC)) {
    fs.copyFileSync(PDF_SRC, PDF_OUT);
    console.log("Copied resume.pdf to public/");
  }
}

main();

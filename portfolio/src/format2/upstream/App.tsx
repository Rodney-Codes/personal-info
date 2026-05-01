// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Menu, X, GitBranch, Mail, Play, Database, ArrowRight, CheckCircle2, Loader2, Sparkles, Code2, Terminal, Server, BarChart3, ExternalLink, Zap, LineChart, ArrowUp, ChevronDown, ChevronUp, Download, MessageCircle, Send } from 'lucide-react';
import { NAV_ITEMS, PROJECT_ICONS, categoryIconForLabel } from './constants';
import SkillChart from './components/SkillChart';
import AiAssistant from './components/AiAssistant';

// Custom LinkedIn Icon with latest design
const LinkedInIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// Tech stack logos for the marquee
const TECH_LOGOS = [
  { src: 'mysql.png', alt: 'MySQL', name: 'MySQL' },
  { src: 'postgresql.png', alt: 'PostgreSQL', name: 'PostgreSQL' },
  { src: 'mongodb.png', alt: 'MongoDB', name: 'MongoDB' },
  { src: 'python.png', alt: 'Python', name: 'Python' },
  { src: 'tableau.png', alt: 'Tableau', name: 'Tableau' },
  { src: 'powerbi.png', alt: 'Power BI', name: 'Power BI' },
  { src: 'metabase.png', alt: 'Metabase', name: 'Metabase' },
  { src: 'google_sheets.png', alt: 'Google Sheets', name: 'Google Sheets' },
  { src: 'github.png', alt: 'GitHub', name: 'GitHub' },
  { src: 'chartdb.png', alt: 'ChartDB', name: 'ChartDB' },
  { src: 'claude.png', alt: 'Claude AI', name: 'Claude' },
  { src: 'excel.png', alt: 'Microsoft Excel', name: 'Excel' },
  { src: 'pandas.png', alt: 'Pandas', name: 'Pandas' },
  { src: 'redash.png', alt: 'Redash', name: 'Redash' },
];

const PROJECT_STOCK_IMAGES = [
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=900&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=900&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=900&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&q=80&auto=format&fit=crop",
];

// Helper: calendar months between start and end (month + year granularity, resume-style ranges)
const calculateDuration = (period: string): string => {
  const raw = String(period || "").trim();
  const parts = raw.split(/\s*(?:--|–|-)\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return "";

  const monthMap: { [key: string]: number } = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const parseBoundary = (dateStr: string): Date | null => {
    const s = dateStr.trim();
    if (!s) return null;
    if (s.toLowerCase() === "present") return new Date();
    const tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return null;
    const monthTok = tokens[0].toLowerCase();
    const yearTok = tokens[tokens.length - 1];
    const key = monthTok.length >= 3 ? monthTok.slice(0, 3) : monthTok;
    const mi = monthMap[key];
    if (mi === undefined) return null;
    let y = parseInt(yearTok, 10);
    if (Number.isNaN(y)) return null;
    if (y < 100) y = y >= 70 ? 1900 + y : 2000 + y;
    return new Date(y, mi, 1);
  };

  const startDate = parseBoundary(parts[0]);
  const endDate = parseBoundary(parts[1]);
  if (!startDate || !endDate) return "";
  if (startDate.getTime() > endDate.getTime()) return "";

  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  const clamped = Math.max(0, months);
  const years = Math.floor(clamped / 12);
  const remainingMonths = clamped % 12;

  if (years === 0) {
    return `${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`;
  }
  if (remainingMonths === 0) {
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  return `${years} ${years === 1 ? "year" : "years"} ${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`;
};

function stripMarkdownMarkers(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  for (let n = 0; n < 8; n++) {
    const next = s.replace(/\*\*([\s\S]*?)\*\*/g, "$1");
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\*+/g, "");
  s = s.replace(/`+/g, "");
  return s.replace(/\s+/g, " ").trim();
}

// Project Card with Slideshow on Hover - Memoized for performance
const ProjectCard = React.memo(({ project, idx }: { project: any; idx: number }) => {
  const Icon = PROJECT_ICONS[project.icon] || Terminal;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Convert project title to URL-friendly slug - memoized
  const projectSlug = React.useMemo(() =>
    project.title.toLowerCase().replace(/\s+/g, '-'),
    [project.title]
  );

  // Slideshow effect - only on hover with faster transitions
  useEffect(() => {
    if (!project.images || project.images.length <= 1 || !isHovered) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % project.images.length);
    }, 1500); // 1.5 seconds for snappier feel

    return () => clearInterval(interval);
  }, [project.images, isHovered]);

  // Reset to first image when hover ends
  useEffect(() => {
    if (!isHovered) {
      setCurrentImageIndex(0);
    }
  }, [isHovered]);

  return (
    <div
      className="group w-full bg-white border border-slate-200 rounded-2xl hover:rounded-[2rem] shadow-sm hover:shadow-xl hover:border-blue-200 overflow-hidden transition-all duration-300 block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex h-[280px]">
        {/* Left: Image Slideshow (40%) */}
        <div className="w-[40%] bg-slate-900 relative overflow-hidden">
          {(project.images && project.images.length > 0
            ? project.images
            : [PROJECT_STOCK_IMAGES[idx % PROJECT_STOCK_IMAGES.length]]
          ).map((img: string, imgIdx: number) => (
            <img
              key={imgIdx}
              src={img}
              alt={`${project.title} ${imgIdx + 1}`}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
              style={{
                opacity: imgIdx === currentImageIndex ? 1 : 0,
              }}
            />
          ))}
        </div>

        {/* Right: Content (60%) */}
        <div className="w-[60%] p-5 flex flex-col justify-between">
          {/* Top */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-blue-50 rounded-lg border border-blue-100 group-hover:bg-blue-100 transition-colors">
                <Icon className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{project.category}</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">{project.year}</span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2.5 leading-tight group-hover:text-blue-600 transition-colors">
              {project.title}
            </h3>

            <div className="space-y-1.5 mb-3">
              {project.description.map((desc: string, i: number) => (
                <p key={i} className="text-slate-600 text-xs leading-relaxed">
                  {desc}
                </p>
              ))}
            </div>
          </div>

          {/* Bottom - Tech Stack */}
          <div className="flex flex-wrap gap-1.5">
            {project.tech.map((tech: string, i: number) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-medium text-slate-700 group-hover:bg-blue-50 group-hover:border-blue-100 group-hover:text-blue-700 transition-all"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

// Bento Grid Project Card
const BentoProjectCard = ({ project }: { project: any }) => {
  const Icon = project.icon ? PROJECT_ICONS[project.icon] : Terminal;

  return (
    <div className="group relative h-full w-full overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 hover:shadow-2xl transition-all duration-500">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={project.image} 
          alt={project.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-40"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent opacity-90 group-hover:opacity-80 transition-opacity"></div>
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-6 z-10">
        {/* Top Icon (Optional floating) */}
        <div className="absolute top-6 right-6 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500">
          <Icon className="w-5 h-5 text-white" />
        </div>

        <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
          <div className="flex items-center gap-2 mb-2">
             <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400">{project.category}</span>
             <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
             <span className="text-[10px] font-mono text-slate-400">{project.year}</span>
          </div>
          
          <h3 className="text-xl md:text-2xl font-bold text-white mb-2 leading-tight">
            {project.title}
          </h3>
          
          <div className="space-y-1 mb-4 opacity-0 group-hover:opacity-100 h-0 group-hover:h-auto transition-all duration-300">
             {project.description.slice(0, 1).map((desc: string, i: number) => (
                <p key={i} className="text-slate-300 text-sm leading-relaxed line-clamp-2">
                   {desc}
                </p>
             ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {project.tech.slice(0, 3).map((t: string) => (
              <span key={t} className="text-[10px] font-medium px-2 py-1 bg-white/10 text-slate-200 rounded-md backdrop-blur-sm border border-white/5">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/** GitHub login from resume contact (profile root URL only). */
function githubUsernameFromContact(contact: any): string {
  const href = contact?.github?.href;
  if (!href || typeof href !== "string" || !href.trim()) return "";
  let u: URL;
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

const GITHUB_AVATAR_STORAGE_PREFIX = "pi_github_avatar:v1:";
const GITHUB_AVATAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
function tokenize(text: string): string[] {
  return String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}

const CHATBOT_API_BASE = String((import.meta as any).env?.VITE_CHATBOT_API_BASE || "").trim();
const CHATBOT_CORPUS_ID = String((import.meta as any).env?.VITE_CHATBOT_CORPUS_ID || "default").trim();
const CHATBOT_ALLOW_FALLBACK =
  String((import.meta as any).env?.VITE_CHATBOT_ALLOW_FALLBACK || "true").trim().toLowerCase() !== "false";

function detectIntent(queryTokens: string[]): "skills" | "experience" | "projects" | "education" | "contact" | "general" {
  const has = (terms: string[]) => terms.some((term) => queryTokens.includes(term));
  if (has(["sql", "python", "skills", "skill", "tools", "stack"])) return "skills";
  if (has(["experience", "years", "worked", "background", "career"])) return "experience";
  if (has(["project", "projects", "built", "build"])) return "projects";
  if (has(["education", "degree", "college", "university"])) return "education";
  if (has(["contact", "email", "linkedin", "github", "reach"])) return "contact";
  return "general";
}

function intentBoost(chunk: any, intent: string): number {
  const section = String(chunk?.section || "").toLowerCase();
  const doc = String(chunk?.doc_id || "").toLowerCase();
  const title = String(chunk?.title || "").toLowerCase();
  const text = `${section} ${doc} ${title}`;
  const intentTerms: Record<string, string[]> = {
    skills: ["skill", "tools", "stack", "sql", "python"],
    experience: ["experience", "summary", "work", "years"],
    projects: ["project"],
    education: ["education", "college", "degree"],
    contact: ["contact", "email", "linkedin", "github"],
    general: [],
  };
  const terms = intentTerms[intent] || [];
  return terms.some((term) => text.includes(term)) ? 2 : 0;
}

function scoreChunk(queryTokens: string[], chunkText: string): number {
  const tokens = tokenize(chunkText);
  if (!tokens.length || !queryTokens.length) return 0;
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  let score = 0;
  for (const token of queryTokens) score += counts.get(token) || 0;
  return score;
}

function searchIndex(index: any[], question: string, topK = 3): any[] {
  const queryTokens = tokenize(question);
  const intent = detectIntent(queryTokens);
  return (Array.isArray(index) ? index : [])
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(queryTokens, String(chunk?.text || "")) + intentBoost(chunk, intent),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function extractBestSentences(text: string, queryTokens: string[], maxSentences = 2): string[] {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) return [];

  const scored = sentences
    .map((sentence) => {
      const tokens = tokenize(sentence);
      let score = 0;
      for (const token of queryTokens) {
        if (tokens.includes(token)) score += 1;
      }
      return { sentence, score };
    })
    .sort((a, b) => b.score - a.score);

  const picked = scored.filter((item) => item.score > 0).slice(0, maxSentences);
  if (picked.length) return picked.map((item) => item.sentence);
  return sentences.slice(0, maxSentences);
}

function detectSkillEntity(question: string): string {
  const q = String(question || "").toLowerCase();
  const known = ["sql", "python", "aws", "tableau", "power bi", "mongodb", "postgresql", "mysql"];
  for (const item of known) {
    if (q.includes(item)) return item;
  }
  return "";
}

function extractYearsValue(text: string): string {
  const normalized = String(text || "");
  const match = normalized.match(/(\d+\+?)\s+years?/i);
  return match ? match[1] : "";
}

function buildTailoredAnswer(results: any[], question: string): string {
  const queryTokens = tokenize(question);
  const intent = detectIntent(queryTokens);
  const asksYears = queryTokens.includes("years") || queryTokens.includes("year");
  const skillEntity = detectSkillEntity(question);
  const top = results[0];
  const second = results[1];

  const lines = extractBestSentences(String(top?.text || ""), queryTokens, 2);
  if (lines.length < 2 && second?.text) {
    const extra = extractBestSentences(String(second.text), queryTokens, 1);
    if (extra.length) lines.push(extra[0]);
  }
  const concise = lines.join(" ").slice(0, 320).trim();
  const yearsValue = extractYearsValue(`${top?.text || ""} ${second?.text || ""}`);

  if (asksYears && skillEntity && yearsValue) {
    const techLabel = skillEntity.toUpperCase() === "AWS" ? "AWS" : skillEntity.toUpperCase();
    const evidence = concise || "my portfolio highlights applied experience across projects and workflows.";
    return `I have about ${yearsValue} years of experience working with ${techLabel}. ${evidence}`.trim();
  }

  const prefixByIntent: Record<string, string> = {
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

async function queryBackendChat(question: string): Promise<any | null> {
  if (!CHATBOT_API_BASE) return null;
  const response = await fetch(`${CHATBOT_API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: question,
      corpus_id: CHATBOT_CORPUS_ID,
      top_k: 3,
      min_score: 0.0,
      allow_fallback: CHATBOT_ALLOW_FALLBACK,
    }),
  });
  if (!response.ok) {
    throw new Error(`Backend chat failed (${response.status})`);
  }
  return response.json();
}

type GithubAvatarCache = { url: string; savedAt: number };

function readGithubAvatarCache(login: string): GithubAvatarCache | null {
  if (typeof window === "undefined" || !login) return null;
  try {
    const raw = localStorage.getItem(GITHUB_AVATAR_STORAGE_PREFIX + login);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GithubAvatarCache;
    if (!parsed || typeof parsed.url !== "string" || !parsed.url.trim()) return null;
    if (typeof parsed.savedAt !== "number" || Number.isNaN(parsed.savedAt)) return null;
    return { url: parsed.url.trim(), savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function writeGithubAvatarCache(login: string, url: string): void {
  if (typeof window === "undefined" || !login || !url.trim()) return;
  try {
    const payload: GithubAvatarCache = { url: url.trim(), savedAt: Date.now() };
    localStorage.setItem(GITHUB_AVATAR_STORAGE_PREFIX + login, JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

function stripUrlQueryForCompare(href: string): string {
  try {
    const u = new URL(href, typeof window !== "undefined" ? window.location.href : "https://example.com");
    u.search = "";
    return u.href;
  } catch {
    return href;
  }
}

const AmaWidget: React.FC<{ chatbotIndexFile: string }> = ({ chatbotIndexFile }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const indexRef = useRef<any[] | null>(null);
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; text: string }>>([
    { role: "assistant", text: "Hi, feel free to ask me anything that you would want to know about me" },
  ]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text: question },
    ]);
    setInput("");
    setSubmitting(true);
    try {
      if (!indexRef.current) {
        const base = ((import.meta as any).env?.BASE_URL ?? "/") as string;
        const bustParam = (import.meta as any).env?.VITE_SITE_DATA_BUST
          ? `?v=${encodeURIComponent(String((import.meta as any).env?.VITE_SITE_DATA_BUST))}`
          : "";
        const response = await fetch(`${base}${chatbotIndexFile}${bustParam}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Could not load ${chatbotIndexFile} (${response.status})`);
        }
        indexRef.current = await response.json();
      }
      const results = searchIndex(indexRef.current || [], question, 3);
      if (!results.length) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "I could not find a grounded answer in the current portfolio documents." },
        ]);
      } else {
        const top = results[0];
        let answer = "";
        try {
          const backend = await queryBackendChat(question);
          if (backend && typeof backend.answer === "string" && backend.answer.trim()) {
            answer = backend.answer.trim();
          }
        } catch (_error) {
          answer = "";
        }
        const tailored = buildTailoredAnswer(results, question);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `${answer || tailored}` },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Search index is unavailable right now. Please try again shortly." },
      ]);
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="mb-3 w-[min(92vw,340px)] rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
            <h3 className="text-sm font-semibold">Ask Me Anything</h3>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800"
              onClick={() => setOpen(false)}
              aria-label="Close AMA chat"
            >
              x
            </button>
          </div>
          <div className="grid max-h-64 gap-2 overflow-y-auto px-3 py-3">
            {messages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto max-w-[90%] bg-blue-700 text-white"
                    : "max-w-[94%] border border-slate-700 bg-slate-800 text-slate-200"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>
          <form className="flex gap-2 border-t border-slate-700 p-3" onSubmit={submit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              disabled={submitting}
              className="flex-1 rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md border border-blue-500 bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        className="group relative inline-flex items-center gap-2 rounded-full border border-blue-400 bg-blue-900 px-3 py-3 text-sm font-semibold text-blue-100 shadow-lg hover:bg-blue-800"
        onClick={() => setOpen((prev) => !prev)}
      >
        <MessageCircle className="h-4 w-4" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-14 group-hover:opacity-100 group-focus-visible:max-w-14 group-focus-visible:opacity-100">
          AMA
        </span>
        <span className="pointer-events-none absolute bottom-[calc(100%+8px)] right-0 translate-y-1 whitespace-nowrap rounded-md border border-[#355783] bg-[#13263f] px-2 py-1 text-[11px] text-[#eaf2ff] opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          Ask me anything
        </span>
      </button>
    </div>
  );
};

const App: React.FC<{ data?: any; runtime?: any }> = ({ data, runtime }) => {
  const [activeSection, setActiveSection] = useState('about');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Pipeline Interaction State
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [pipelineResultVisible, setPipelineResultVisible] = useState(false);

  // Skills Animation State
  const [skillsVisible, setSkillsVisible] = useState(false);
  const skillsRef = useRef<HTMLElement>(null);

  // Experience Animation State
  const [experienceVisible, setExperienceVisible] = useState(false);
  const experienceRef = useRef<HTMLElement>(null);

  // Project Filter State
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewAllProjects, setViewAllProjects] = useState(false);

  // Navbar Animation Refs
  const navRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<{ [key: string]: HTMLAnchorElement | null }>({});
  const [navIndicatorStyle, setNavIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });

  // Manual Scroll Tracker to prevent Observer interference
  const isManualScroll = useRef(false);

  // Scroll To Top State
  const [showScrollTop, setShowScrollTop] = useState(false);
  const profileName = String(data?.name || "").trim();
  const nameParts = profileName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "User";
  const logoInitials = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
    : (nameParts[0] || "U").toUpperCase();
  const emailText = String(data?.contact?.email?.text || "").trim();
  const linkedInRaw = String(data?.contact?.linkedin?.href || "").trim();
  const linkedInUrl = linkedInRaw
    ? (linkedInRaw.startsWith("http") ? linkedInRaw : `https://${linkedInRaw}`)
    : "#";
  const scheduleCallUrl = emailText ? `mailto:${emailText}?subject=Let's discuss a data project` : "#";
  const githubUrl = String(data?.contact?.github?.href || "").trim() || "#";
  const resumeSummaryText = String(data?.summary || "").trim();
  const resumeSkillTokens = (data?.skills || [])
    .flatMap((row: any) => String(row?.value || "").split(","))
    .map((s: string) => s.trim())
    .filter(Boolean);
  const resumeSkillsSnippet = resumeSkillTokens.slice(0, 8).join(", ");
  const aboutText = data?.portfolio?.aboutMe || resumeSummaryText;
  const coreSkillsText = resumeSkillsSnippet ? `Core skills: ${resumeSkillsSnippet}.` : "";
  const ui = data?.ui && typeof data.ui === "object" ? data.ui : {};
  const heroTaglineText =
    (ui.heroTagline && String(ui.heroTagline).trim()) ||
    "I build data systems that get results.";
  const impactMainHeading =
    (ui.impactAtAGlanceHeading && String(ui.impactAtAGlanceHeading).trim()) ||
    "Results that matter";
  const toolsStackPill =
    (ui.toolsAndStackHeading && String(ui.toolsAndStackHeading).trim()) ||
    "Core Competencies";
  const skillsSectionBlurb =
    stripMarkdownMarkers(String(data?.portfolio?.whatIDoBest || "").trim()) ||
    "Proven expertise in transforming raw data into actionable insights through end-to-end data solutions.";
  const workHighlightsHeading =
    (ui.workHighlightsHeading && String(ui.workHighlightsHeading).trim()) ||
    "Professional Journey";
  const workHighlightsLede = String(ui.workHighlightsLede || "").trim();
  const projectsMainHeading =
    (ui.projectsHeading && String(ui.projectsHeading).trim()) ||
    "Featured Projects";
  const baseUrl = ((import.meta as any).env?.BASE_URL ?? "/") as string;
  const profilePhotoRaw = String(ui.profilePhotoUrl || "").trim();
  const explicitProfilePhotoSrc = profilePhotoRaw
    ? profilePhotoRaw.startsWith("http://") || profilePhotoRaw.startsWith("https://")
      ? profilePhotoRaw
      : `${baseUrl}${profilePhotoRaw.replace(/^\/+/, "")}`
    : "";
  const localProfileFallback = `${baseUrl}local-assets/profile.png`;
  const githubUser = useMemo(
    () => githubUsernameFromContact(data?.contact),
    [data?.contact?.github?.href],
  );
  const optimisticGithubAvatarPng = useMemo(() => {
    if (!githubUser) return "";
    return `https://github.com/${githubUser}.png?t=${Date.now()}`;
  }, [githubUser]);
  const githubAvatarCacheEntry = useMemo(() => {
    if (!githubUser || profilePhotoRaw) return null;
    return readGithubAvatarCache(githubUser);
  }, [githubUser, profilePhotoRaw]);
  const githubCachedAvatarUrl = githubAvatarCacheEntry?.url || null;
  const [gitHubFetchedAvatarSrc, setGitHubFetchedAvatarSrc] = useState<string | null>(null);
  useEffect(() => {
    if (profilePhotoRaw || !githubUser) {
      setGitHubFetchedAvatarSrc(null);
      return;
    }
    const cached = readGithubAvatarCache(githubUser);
    const cacheFresh =
      cached &&
      Date.now() - cached.savedAt < GITHUB_AVATAR_CACHE_TTL_MS;
    if (cacheFresh) {
      setGitHubFetchedAvatarSrc(null);
      return;
    }
    let cancelled = false;
    fetch(`https://api.github.com/users/${encodeURIComponent(githubUser)}`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        const u = j?.avatar_url;
        if (cancelled || typeof u !== "string" || !u.trim()) return;
        const base = u.trim();
        writeGithubAvatarCache(githubUser, base);
        const bust = `${base.includes("?") ? "&" : "?"}t=${Date.now()}`;
        setGitHubFetchedAvatarSrc(`${base}${bust}`);
      })
      .catch(() => {
        if (!cancelled) setGitHubFetchedAvatarSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profilePhotoRaw, githubUser]);
  const profilePhotoSrc =
    explicitProfilePhotoSrc ||
    gitHubFetchedAvatarSrc ||
    githubCachedAvatarUrl ||
    optimisticGithubAvatarPng ||
    localProfileFallback;
  const profilePhotoAlt = profileName || "Profile photo";
  const chatbotIndexFile = String(runtime?.chatbotIndexFile || "chatbot/index.default.json");
  const pdfFile = runtime?.pdfFile ? String(runtime.pdfFile).trim() : "";
  const resumePdfHref =
    data?.pdfAvailable && pdfFile ? `${baseUrl}${pdfFile}` : null;
  const pdfButtonLabel = String(data?.ui?.pdfButton || "Download resume").trim();
  const resumeWorkflowTitle = (() => {
    const s = runtime?.selected;
    if (!s || typeof s !== "object") return undefined;
    const rc = String(s.resume_content_id || "").trim();
    const rf = String(s.resume_format_id || "").trim();
    if (!rc && !rf) return undefined;
    const parts = [rc && `${rc}.md`, rf].filter(Boolean);
    return parts.length
      ? `Resume PDF from workflow: ${parts.join(" + ")} (run sync or CI to rebuild)`
      : undefined;
  })();
  const skillTokens = (data?.skills || [])
    .flatMap((row: any) => String(row?.value || "").split(","))
    .map((s: string) => s.trim())
    .filter(Boolean);
  const primarySkill = skillTokens[0] || "Python";
  const secondarySkill = skillTokens[1] || "SQL";
  const projectDeliveredValue = String(data?.ui?.photoProjectsDelivered || "").trim();
  const projectDeliveredDescription = String(data?.ui?.photoProjectsDeliveredDescription || "").trim();
  const projectDeliveredText = projectDeliveredValue || "--";
  const parseStartDate = (range: string) => {
    const from = String(range || "").split(/\s*(?:--|–|-)\s*/)[0]?.trim();
    const [mon, yr] = from.split(/\s+/);
    if (!mon || !yr) return null;
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = monthMap[mon.toLowerCase()];
    const year = Number(yr);
    if (month == null || Number.isNaN(year)) return null;
    return new Date(year, month, 1);
  };
  const startDates = (data?.experience || [])
    .map((row: any) => parseStartDate(row?.dates))
    .filter(Boolean) as Date[];
  const earliestStart = startDates.length
    ? new Date(Math.min(...startDates.map((d) => d.getTime())))
    : null;
  const yearsExperience = earliestStart
    ? Math.max(1, Math.floor((Date.now() - earliestStart.getTime()) / (1000 * 60 * 60 * 24 * 365.25)))
    : 3;
  const yearsBadgeText = `${yearsExperience}+`;
  const defaultImpactMetrics = [
    { value: "--", title: "Metric", description: "Add impact metrics in portfolio_2.md under '## Impact metrics'." },
  ];
  const parsedImpactMetrics = String(data?.portfolio?.impactAtAGlance || "")
    .split(/\n\s*\n/)
    .map((block: string) => block.split("\n").map((s) => s.trim()).filter(Boolean))
    .map((parts: string[]) => ({
      value: parts[0] || "",
      title: parts[1] || "",
      description: parts.slice(2).join(" "),
    }))
    .filter((m: any) => m.value && m.title && m.description);
  const withoutDuplicateProjects = parsedImpactMetrics.filter(
    (m: any) => m.title.trim().toLowerCase() !== "projects delivered",
  );
  const impactMetricsBase =
    withoutDuplicateProjects.length > 0 ? withoutDuplicateProjects : defaultImpactMetrics;
  const impactMetrics =
    projectDeliveredValue && projectDeliveredValue !== "--"
      ? [
          ...impactMetricsBase,
          {
            value: projectDeliveredValue,
            title: "Projects Delivered",
            description:
              projectDeliveredDescription ||
              "Update photoProjectsDeliveredDescription in portfolio frontmatter for this blurb.",
          },
        ]
      : impactMetricsBase;
  const impactMetricStyles = [
    { border: "hover:border-blue-300", chip: "from-blue-500 to-blue-600", value: "text-blue-600", icon: BarChart3 },
    { border: "hover:border-purple-300", chip: "from-purple-500 to-purple-600", value: "text-purple-600", icon: Database },
    { border: "hover:border-emerald-300", chip: "from-emerald-500 to-emerald-600", value: "text-emerald-600", icon: Server },
    { border: "hover:border-orange-300", chip: "from-orange-500 to-orange-600", value: "text-orange-600", icon: LineChart },
    { border: "hover:border-cyan-300", chip: "from-cyan-500 to-cyan-600", value: "text-cyan-600", icon: Code2 },
    { border: "hover:border-pink-300", chip: "from-pink-500 to-pink-600", value: "text-pink-600", icon: CheckCircle2 },
  ];
  const profileSkillGroups = (data?.skills || []).map((row: any) => ({
    category: row?.label || "Skills",
    skills: String(row?.value || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean),
  }));
  const profileExperience = (data?.experience || []).map((job: any) => {
    const rawAchievements = Array.isArray(job?.bullets)
      ? job.bullets
      : Array.isArray(job?.achievements)
        ? job.achievements
        : [];
    return {
      role: job?.title || job?.role || "",
      company: job?.company || "",
      location: job?.location || "",
      period: job?.dates || job?.period || "",
      achievements: rawAchievements.map((line: unknown) => stripMarkdownMarkers(String(line))),
    };
  });
  const inferredProjectTech = resumeSkillTokens.slice(0, 3);
  const profileProjects = (data?.projects || []).map((project: any, idx: number) => {
    const datesText = String(project?.dates || project?.year || "");
    const year = (datesText.match(/\b(19|20)\d{2}\b/) || [datesText])[0] || "";
    const bullets = Array.isArray(project?.bullets) ? project.bullets : [];
    return {
      title: project?.title || `Project ${idx + 1}`,
      category: project?.category || "Projects",
      year,
      description: bullets.length > 0 ? bullets : [String(project?.company || "").trim()].filter(Boolean),
      tech: Array.isArray(project?.tech) && project.tech.length > 0 ? project.tech : inferredProjectTech,
      icon: project?.icon || "Terminal",
      images: (() => {
        const fromData = Array.isArray(project?.images)
          ? project.images.map(String).map((s) => s.trim()).filter(Boolean)
          : [];
        if (fromData.length > 0) return fromData;
        return [PROJECT_STOCK_IMAGES[idx % PROJECT_STOCK_IMAGES.length]];
      })(),
    };
  });

  // Update Navbar Indicator Position on activeSection change or Resize
  useEffect(() => {
    const updatePosition = () => {
      const activeTab = tabsRef.current[activeSection];
      if (activeTab) {
        setNavIndicatorStyle({
          left: activeTab.offsetLeft,
          width: activeTab.offsetWidth,
          opacity: 1
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [activeSection]);

  // Scroll Listener for "Back to Top" button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll handler
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.substring(1);
    
    // 1. Immediately update active section so the pill animates directly to target
    setActiveSection(targetId);
    setMobileMenuOpen(false);

    // 2. Set manual scroll flag to block intersection observer updates
    isManualScroll.current = true;

    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      
      // 3. Reset flag after sufficient time for scroll to complete
      setTimeout(() => {
        isManualScroll.current = false;
      }, 1000);
    }
  };

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveSection('about');
    isManualScroll.current = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { isManualScroll.current = false; }, 1000);
  };

  // Run Pipeline Handler
  const handleRunPipeline = () => {
    if (pipelineResultVisible) return;
    setIsPipelineRunning(true);
    setTimeout(() => {
      setIsPipelineRunning(false);
      setPipelineResultVisible(true);
    }, 1500); 
  };

  // Close Pipeline Result
  const handleClosePipeline = () => {
    setPipelineResultVisible(false);
  };

  // Intersection observer for scrolling
  useEffect(() => {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Only update if not currently performing a manual scroll
          if (entry.isIntersecting && !isManualScroll.current) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );

    document.querySelectorAll('section[id]').forEach((section) => {
      sectionObserver.observe(section);
    });

    const skillsObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setSkillsVisible(true);
          skillsObserver.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (skillsRef.current) {
      skillsObserver.observe(skillsRef.current);
    }

    const experienceObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setExperienceVisible(true);
          experienceObserver.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (experienceRef.current) {
      experienceObserver.observe(experienceRef.current);
    }

    return () => {
      sectionObserver.disconnect();
      skillsObserver.disconnect();
      experienceObserver.disconnect();
    };
  }, []);

  // Compute unique categories and filtered projects
  const uniqueCategories = ['All', ...Array.from(new Set(profileProjects.map((p: any) => p.category).filter(Boolean) as string[]))];
  
  const filteredProjects = activeCategory === 'All'
    ? profileProjects
    : profileProjects.filter((p: any) => p.category === activeCategory);

  // Logic for view more
  const visibleProjectsList = viewAllProjects ? filteredProjects : filteredProjects.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 relative">
      
      {/* Decorative Top-Left Circle */}
      <div className="fixed -top-20 -left-20 w-80 h-80 bg-blue-100/60 rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* Navigation - Floating iOS Liquid Pill */}
      <nav className="fixed top-0 w-full z-40 pointer-events-none">
        <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
          {/* Logo */}
          <a href="#" onClick={scrollToTop} className="pointer-events-auto relative group">
            <div className="flex items-center gap-0.5 font-bold text-xl tracking-tighter font-mono px-5 py-2">
              <span className="text-blue-500 transition-transform duration-300 group-hover:-translate-x-1">{'<'}</span>
              <span className="text-slate-900">{logoInitials}</span>
              <span className="text-blue-500 transition-transform duration-300 group-hover:translate-x-1">{'/>'}</span>
            </div>
          </a>
          
          {/* Desktop Nav - Centered Liquid Pill with Smooth Animation */}
          <div className="pointer-events-auto hidden md:block absolute left-1/2 top-6 -translate-x-1/2">
            <div 
              ref={navRef}
              className="relative flex items-center gap-1 bg-white/70 backdrop-blur-xl backdrop-saturate-150 border border-white/20 ring-1 ring-black/5 rounded-full px-2 py-1.5 shadow-lg shadow-slate-200/20"
            >
              {/* Sliding Background Pill */}
              <div 
                className="absolute bg-slate-900 rounded-full shadow-md transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)]"
                style={{
                  left: navIndicatorStyle.left,
                  width: navIndicatorStyle.width,
                  height: 'calc(100% - 12px)', // vertical padding adjustment
                  top: '6px',
                  opacity: navIndicatorStyle.opacity
                }}
              />

              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  ref={(el) => { tabsRef.current[item.href.substring(1)] = el; }}
                  onClick={(e) => scrollToSection(e, item.href)}
                  className={`relative z-10 px-5 py-2 text-sm font-medium rounded-full transition-colors duration-300 ${
                    activeSection === item.href.substring(1) 
                      ? 'text-white' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="pointer-events-auto md:hidden text-slate-600 p-2 bg-white rounded-full border border-slate-100 shadow-sm relative z-50"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Nav Overlay */}
        {mobileMenuOpen && (
          <div className="pointer-events-auto md:hidden absolute top-24 left-4 right-4 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-2xl animate-slide-up z-50">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => scrollToSection(e, item.href)}
                className={`text-slate-600 hover:text-black hover:bg-slate-50 px-4 py-3 rounded-xl font-medium transition-colors ${
                   activeSection === item.href.substring(1) ? 'bg-slate-50 text-black' : ''
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="about" className="scroll-mt-28 pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-20 min-h-[85vh] justify-center overflow-x-clip">
        <div className="flex-1 flex flex-col items-start z-10 w-full md:w-auto max-w-2xl">

          {/* Group 1: Identity */}
          <div className="mb-10 space-y-4">
             <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-slate-900 tracking-tighter leading-none">
               <span className="block">Hi, I'm</span>
               <span className="block text-blue-500 mt-2">{firstName}.</span>
             </h1>
             <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight leading-snug">
               {heroTaglineText}
             </h2>
             <p className="text-lg text-slate-500 leading-relaxed max-w-xl">
               {aboutText}
               {coreSkillsText ? (
                 <>
                   <br />
                   <br />
                   {coreSkillsText}
                 </>
               ) : null}
             </p>
          </div>

          {/* Group 3: Actions */}
          <div className="flex flex-col gap-6">
             <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <a
                  href={scheduleCallUrl}
                  className="group w-full sm:w-auto min-w-[180px] justify-center px-8 py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:scale-105 hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <Mail className="w-4 h-4 group-hover:rotate-12 group-hover:scale-110 transition-all duration-300" />
                  Schedule a Call
                </a>
                <a
                  href={linkedInUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group w-full sm:w-auto min-w-[180px] justify-center px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 hover:border-blue-300 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 hover:shadow-md flex items-center gap-2"
                >
                  <LinkedInIcon size={16} className="group-hover:scale-110 transition-all duration-300" />
                  View Profile
                </a>
             </div>

             {resumePdfHref ? (
               <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                 <a
                   href={resumePdfHref}
                   title={resumeWorkflowTitle}
                   onClick={(e) => {
                     e.currentTarget.download = `rr_resume_${Date.now()}.pdf`;
                   }}
                   className="group w-full sm:w-auto min-w-[180px] justify-center px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 hover:border-slate-300 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 hover:shadow-md flex items-center gap-2"
                 >
                   <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform duration-300" />
                   {pdfButtonLabel}
                 </a>
               </div>
             ) : null}

             {/* Open to Opportunities Badge - More compelling */}
             <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-200 self-start hover:border-emerald-300 transition-all duration-300 cursor-default shadow-sm">
                <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-500">
                  <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></span>
                </span>
                <span className="text-xs font-bold text-slate-900 tracking-wide uppercase">Open to Full-Time & Freelance</span>
             </div>
          </div>

        </div>
        
        {/* Photo Section - Data-Centric Professional Design */}
        <div className="flex-1 w-full max-w-[600px] flex justify-center items-center relative mt-32 md:mt-10">

          {/* Subtle Dot Grid Background - Data Aesthetic */}
          <div className="absolute inset-0 opacity-[0.15]" style={{
            backgroundImage: 'radial-gradient(circle, #64748b 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)'
          }}></div>

          {/* Main Photo Container - Group for hover effects */}
          <div className="relative z-10 flex items-center justify-center group">
            {/* Geometric Accent Shape - Rotated Square (Data Viz Element) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
              <div className="hero-accent-shape absolute w-[420px] h-[420px] rounded-[3rem] rotate-45 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-600/10 blur-2xl"></div>
              <div className="absolute w-[380px] h-[380px] rounded-[2.5rem] rotate-12 border-2 border-blue-500/10"></div>
            </div>

            {/* Photo Circle with Gradient Border - Photo Extends Beyond */}
            <div className="relative">
              {/* Animated Gradient Border */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-all duration-500 animate-pulse-slow"></div>

              {/* Photo Frame - Photo extends beyond the frame */}
              <div className="relative w-80 h-80 md:w-96 md:h-96 rounded-full bg-white p-2 shadow-2xl transform transition-all duration-500 group-hover:scale-105 overflow-visible">
                <div className="w-full h-full rounded-full border-4 border-slate-100 relative overflow-visible">
                  {/* Photo extends upward beyond the circular frame */}
                  <img
                    src={profilePhotoSrc}
                    alt={profilePhotoAlt}
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[110%] h-[130%] object-cover object-top transform transition-all duration-500 group-hover:scale-105 rounded-full"
                    style={{
                      clipPath: 'ellipse(50% 65% at 50% 65%)'
                    }}
                    onError={(e) => {
                      const el = e.currentTarget;
                      const cur = stripUrlQueryForCompare(el.src);
                      if (
                        !explicitProfilePhotoSrc &&
                        githubCachedAvatarUrl &&
                        stripUrlQueryForCompare(githubCachedAvatarUrl) !== cur
                      ) {
                        el.src = githubCachedAvatarUrl;
                        return;
                      }
                      if (!explicitProfilePhotoSrc && githubUser) {
                        const png = `https://github.com/${githubUser}.png`;
                        if (stripUrlQueryForCompare(png) !== cur) {
                          el.src = png;
                          return;
                        }
                      }
                      if (stripUrlQueryForCompare(localProfileFallback) !== cur) {
                        el.src = localProfileFallback;
                        return;
                      }
                      el.src =
                        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop";
                      el.onerror = null;
                    }}
                  />
                  {/* Subtle overlay gradient on hover only */}
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full pointer-events-none"></div>
                </div>
              </div>
            </div>

            {/* Floating Stat Badges - Glassmorphic */}
            {/* Badge 1: Top Left - Years of Experience */}
            <div className="stat-badge absolute top-20 -left-16 md:-left-20 animate-float" style={{ animationDelay: '0s' }}>
              <div className="backdrop-blur-xl bg-white/80 border border-slate-200/50 rounded-2xl px-5 py-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">{yearsBadgeText}</span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Years</p>
                    <p className="text-sm font-bold text-slate-900">Experience</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Badge 2: Top Right - Projects Delivered */}
            <div className="stat-badge absolute top-32 -right-12 md:-right-16 animate-float" style={{ animationDelay: '1s' }}>
              <div className="backdrop-blur-xl bg-white/80 border border-slate-200/50 rounded-2xl px-5 py-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">{projectDeliveredText}</span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Projects</p>
                    <p className="text-sm font-bold text-slate-900">Delivered</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Badge 3: Bottom Left - Tech Stack */}
            <div className="stat-badge absolute bottom-12 -left-8 md:-left-12 animate-float" style={{ animationDelay: '2s' }}>
              <div className="backdrop-blur-xl bg-white/80 border border-slate-200/50 rounded-2xl px-5 py-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-default">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{primarySkill}</p>
                    <p className="text-sm font-bold text-slate-900">{secondarySkill} Expert</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Impact Dashboard - Key Metrics */}
      <section className="py-20 bg-gradient-to-b from-white via-slate-50 to-white relative overflow-hidden">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:48px_48px] opacity-40"></div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 mb-4">
              <Zap className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Impact Metrics</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3 tracking-tight">
              {impactMainHeading}
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Real outcomes from data engineering and analytics projects
            </p>
          </div>

          {/* Metrics Grid - 3x2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {impactMetrics.slice(0, 6).map((metric: any, idx: number) => {
              const style = impactMetricStyles[idx] || impactMetricStyles[0];
              const Icon = style.icon;
              return (
                <div key={`${metric.title}-${idx}`} className={`group relative bg-white rounded-2xl border-2 border-slate-200 p-6 ${style.border} hover:shadow-xl transition-all duration-300`}>
                  <div className={`absolute -top-3 -right-3 w-12 h-12 bg-gradient-to-br ${style.chip} rounded-xl rotate-12 group-hover:rotate-45 transition-transform duration-500 flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className={`text-5xl font-bold ${style.value}`}>{metric.value}</h3>
                    <p className="text-slate-900 font-semibold text-lg">{metric.title}</p>
                    <p className="text-slate-600 text-sm leading-relaxed">{metric.description}</p>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills" ref={skillsRef} className="scroll-mt-28 py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row gap-20 items-center">
            
            {/* Skills List */}
            <div className="flex-1 w-full space-y-12">
              <div className={`transition-all duration-700 ${skillsVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 mb-4">
                  <Sparkles className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{toolsStackPill}</span>
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">What I bring to the table</h2>
                <p className="text-slate-600 text-lg leading-relaxed">
                  {skillsSectionBlurb}
                </p>
              </div>
              
              <div className="space-y-8">
                {profileSkillGroups.map((category: any, idx: number) => {
                  const SkillCategoryIcon = categoryIconForLabel(category.category);
                  return (
                  <div
                    key={category.category}
                    style={{ transitionDelay: `${idx * 100}ms` }}
                    className={`group transition-all duration-700 transform ${
                      skillsVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-10'
                    }`}
                  >
                    <div className="flex items-start gap-5">
                      <div className="mt-1 p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                        <div className="w-5 h-5 flex items-center justify-center">
                            <SkillCategoryIcon size={20} />
                        </div>
                      </div>
                      <div className="flex-1 border-b border-slate-100 pb-6 group-hover:border-slate-200 transition-colors">
                        <h3 className="text-base font-bold text-slate-900 mb-4">{category.category}</h3>
                        <div className="flex flex-wrap gap-2.5">
                          {category.skills.map((skill) => (
                            <span key={skill} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Radar Chart */}
            <div className={`flex-1 w-full flex justify-center items-center transition-all duration-1000 delay-300 ${
               skillsVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}>
               <div className="relative p-8 bg-white/40 backdrop-blur-md rounded-3xl border border-slate-100 shadow-xl w-full max-w-[500px]">
                 <SkillChart />
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Logos - Infinite Horizontal Scroll Marquee */}
      <section className="py-20 bg-gradient-to-r from-slate-50 via-white to-slate-50 overflow-hidden" aria-label="Technology Stack">
        {/* Header */}
        <div className="text-center mb-12 px-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 mb-4">
            <Code2 className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Tech Stack</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
            Tools & Technologies I Use
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Databases, BI tools, and frameworks powering data-driven solutions
          </p>
        </div>

        {/* Outer wrapper with overflow hidden */}
        <div className="relative w-full overflow-hidden">
          {/* Inner track wrapper - pauses on hover */}
          <div className="logo-marquee-track group">
            {/* First set of logos */}
            <div className="logo-marquee-content">
              {TECH_LOGOS.map((logo, idx) => (
                <div
                  key={`logo-primary-${idx}`}
                  className="logo-marquee-item"
                  role="listitem"
                >
                  <div className="logo-wrapper">
                    <img
                      src={`${baseUrl}${logo.src}`}
                      alt={logo.alt}
                      title={logo.name}
                      className="logo-image"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Duplicate set for seamless infinite loop - hidden from screen readers */}
            <div className="logo-marquee-content" aria-hidden="true">
              {TECH_LOGOS.map((logo, idx) => (
                <div
                  key={`logo-duplicate-${idx}`}
                  className="logo-marquee-item"
                >
                  <div className="logo-wrapper">
                    <img
                      src={`${baseUrl}${logo.src}`}
                      alt=""
                      className="logo-image"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Me Different Section */}
      <section className="scroll-mt-28 py-24 bg-gradient-to-b from-white via-slate-50 to-white relative overflow-hidden">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:48px_48px] opacity-40"></div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 mb-4">
              <Sparkles className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">What Makes Me Different</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
              Most data analysts stop at insights.
            </h2>
            <p className="text-2xl text-slate-600 font-medium">
              I go further.
            </p>
          </div>

          {/* 3 Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {/* Card 1: End-to-End Ownership */}
            <div className="group bg-white rounded-2xl p-8 border border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">End-to-End Ownership</h3>
              <p className="text-slate-600 leading-relaxed">
                From raw data extraction to dashboard deployment
              </p>
            </div>

            {/* Card 2: Production-First Mindset */}
            <div className="group bg-white rounded-2xl p-8 border border-slate-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                <Server className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Production-First Mindset</h3>
              <p className="text-slate-600 leading-relaxed">
                Code that runs in production, not just notebooks
              </p>
            </div>

            {/* Card 3: Performance Obsessed */}
            <div className="group bg-white rounded-2xl p-8 border border-slate-200 hover:border-emerald-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                <Zap className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Performance Obsessed</h3>
              <p className="text-slate-600 leading-relaxed">
                80% faster queries, 50% fewer pipelines
              </p>
            </div>
          </div>

          {/* My Approach - 4 Steps */}
          <div className="bg-white rounded-2xl p-10 border border-slate-200 mb-12">
            <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">My Approach</h3>

            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
              {/* Step 1: Problem */}
              <div className="text-center flex-1">
                <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 font-bold text-lg">1</span>
                </div>
                <h4 className="font-bold text-slate-900 mb-2">
                  Problem
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Understand the business need, not just the data request
                </p>
              </div>

              {/* Arrow 1->2 */}
              <ArrowRight className="w-6 h-6 text-slate-400 hidden md:block flex-shrink-0 mt-[-80px]" />

              {/* Step 2: Design */}
              <div className="text-center flex-1">
                <div className="w-12 h-12 rounded-full bg-purple-100 border-2 border-purple-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-purple-600 font-bold text-lg">2</span>
                </div>
                <h4 className="font-bold text-slate-900 mb-2">
                  Design
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Build scalable solutions that handle edge cases
                </p>
              </div>

              {/* Arrow 2->3 */}
              <ArrowRight className="w-6 h-6 text-slate-400 hidden md:block flex-shrink-0 mt-[-80px]" />

              {/* Step 3: Deploy */}
              <div className="text-center flex-1">
                <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-600 font-bold text-lg">3</span>
                </div>
                <h4 className="font-bold text-slate-900 mb-2">
                  Deploy
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Ship production-ready code with error handling
                </p>
              </div>

              {/* Arrow 3->4 */}
              <ArrowRight className="w-6 h-6 text-slate-400 hidden md:block flex-shrink-0 mt-[-80px]" />

              {/* Step 4: Optimize */}
              <div className="text-center flex-1">
                <div className="w-12 h-12 rounded-full bg-orange-100 border-2 border-orange-500 flex items-center justify-center mx-auto mb-4">
                  <span className="text-orange-600 font-bold text-lg">4</span>
                </div>
                <h4 className="font-bold text-slate-900 mb-2">
                  Optimize
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Continuously improve performance and efficiency
                </p>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className="text-center">
            <p className="text-2xl md:text-3xl font-medium text-slate-700 italic leading-relaxed max-w-4xl mx-auto">
              &ldquo;{heroTaglineText}&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Experience Section - Flowing Path Design */}
      <section id="experience" ref={experienceRef} className="scroll-mt-28 py-24 bg-gradient-to-b from-slate-50/50 via-white to-slate-50/50 relative overflow-hidden">
        {/* Subtle Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        <div className="max-w-6xl mx-auto px-6 relative">
          {/* Header */}
          <div className={`text-center mb-20 transition-all duration-700 ${experienceVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 mb-4">
              <Server className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Experience</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">{workHighlightsHeading}</h2>
            {workHighlightsLede ? (
              <p className="text-slate-500 text-lg">{workHighlightsLede}</p>
            ) : (
              <p className="text-slate-500 text-lg">Following the path of data excellence</p>
            )}
          </div>

          {/* Journey Path Container - Overflow to extend beyond section */}
          <div className="relative max-w-5xl mx-auto overflow-visible">

            {/* Flowing SVG Path - Desktop - Full width with beautiful S-curve */}
            <svg className="hidden md:block absolute pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex: 0, top: '-20%', left: 0, width: '100%', height: '140%' }}>
              <defs>
                {/* Gradient for fading path at top and bottom - fade earlier at top to stay below subtitle */}
                <linearGradient id="pathFade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" stopOpacity="0" />
                  <stop offset="32%" stopColor="#93c5fd" stopOpacity="1" />
                  <stop offset="85%" stopColor="#93c5fd" stopOpacity="1" />
                  <stop offset="100%" stopColor="#93c5fd" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Extended Blue Path with Smooth S-Curve */}
              <path
                d="M 50 0 C 50 20, 60 30, 55 50 C 50 70, 45 80, 50 100"
                stroke="url(#pathFade)"
                strokeWidth="1.2"
                fill="none"
                strokeLinecap="round"
                className={`transition-all duration-1000 ${experienceVisible ? 'opacity-100' : 'opacity-0'}`}
              />

              {/* White Dotted Line Moving Inside - Bottom to Top */}
              <path
                d="M 50 0 C 50 20, 60 30, 55 50 C 50 70, 45 80, 50 100"
                stroke="#ffffff"
                strokeWidth="0.25"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="2 4"
                className={`transition-all duration-1000 ${experienceVisible ? 'opacity-100' : 'opacity-0'}`}
                style={{
                  animation: experienceVisible ? 'moveDotsUp 1.8s linear infinite' : 'none'
                }}
              />
            </svg>

            {/* Mobile Line */}
            <div className="md:hidden absolute left-6 top-0 bottom-0 w-[3px] bg-gradient-to-b from-blue-200 via-blue-400 to-blue-200 rounded-full overflow-hidden">
              {/* Animated gradient flowing up */}
              <div className={`absolute inset-0 bg-gradient-to-t from-transparent via-blue-500 to-transparent h-[40%] ${experienceVisible ? 'animate-beam-up' : ''}`}></div>
            </div>

            {/* Experience Items */}
            <div className="space-y-0 relative" style={{ zIndex: 1 }}>
              {profileExperience.map((job: any, idx: number) => {
                const isEven = idx % 2 === 0;
                const durationLabel = calculateDuration(job.period);

                return (
                  <div
                    key={idx}
                    style={{ transitionDelay: `${idx * 200}ms` }}
                    className={`relative pb-16 last:pb-0 transition-all duration-700 ${experienceVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                  >
                    {/* Desktop Layout - Alternating */}
                    <div className={`hidden md:grid grid-cols-2 gap-12 items-center`}>

                      {/* Content Card */}
                      <div className={`${isEven ? 'text-left' : 'text-left col-start-2 ml-8'}`}>
                        {/* Period Badge */}
                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-blue-50 border border-blue-100`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <span className="text-xs font-semibold text-blue-700 tracking-wide">{job.period}</span>
                        </div>

                        {/* Card */}
                        <div className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-md hover:shadow-2xl hover:border-blue-300 transition-all duration-300 relative">
                          {/* Connecting Line to Path */}
                          <div className={`hidden md:block absolute top-1/2 -translate-y-1/2 ${isEven ? '-right-12 left-full' : '-left-12 right-full'} w-12 h-[2px] bg-gradient-to-r ${isEven ? 'from-slate-200 to-transparent' : 'from-transparent to-slate-200'}`}></div>

                          <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                              {job.role}
                            </h3>
                            <div className="flex items-center gap-2 text-slate-600 text-sm">
                              <span className="font-medium">{job.company}</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-500">{job.location}</span>
                            </div>
                            {durationLabel ? (
                              <div className="mt-1 text-xs text-slate-500">{durationLabel}</div>
                            ) : null}
                          </div>

                          <ul className="space-y-2.5">
                            {job.achievements.slice(0, 3).map((achievement, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-slate-700 text-sm leading-relaxed">
                                <div className="mt-2 w-1 h-1 rounded-full bg-blue-400 shrink-0"></div>
                                <span>{achievement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden flex gap-6">
                      <div className="relative flex flex-col items-center shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg flex items-center justify-center z-10">
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        </div>
                      </div>

                      <div className="flex-1 pb-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-blue-50 border border-blue-100">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <span className="text-xs font-semibold text-blue-700">{job.period}</span>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-lg transition-shadow">
                          <div className="mb-3">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">{job.role}</h3>
                            <div className="text-slate-600 text-sm">
                              <span className="font-medium">{job.company}</span>
                              <span className="text-slate-400 mx-1">•</span>
                              <span className="text-slate-500">{job.location}</span>
                            </div>
                            {durationLabel ? (
                              <div className="mt-1 text-xs text-slate-500">{durationLabel}</div>
                            ) : null}
                          </div>

                          <ul className="space-y-2">
                            {job.achievements.slice(0, 3).map((achievement, i) => (
                              <li key={i} className="flex items-start gap-2 text-slate-700 text-sm leading-relaxed">
                                <div className="mt-2 w-1 h-1 rounded-full bg-blue-400 shrink-0"></div>
                                <span>{achievement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section - Minimal Cards with Hover */}
      <section id="projects" className="scroll-mt-28 py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 mb-4">
                <Terminal className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Portfolio</span>
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">{projectsMainHeading}</h2>
              <p className="text-slate-500 font-light text-lg">Data engineering & analytics work</p>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {uniqueCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 ${
                    activeCategory === category
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Projects Grid - 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map((project, idx) => (
              <ProjectCard key={idx} project={project} idx={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 blur-sm"></div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 mb-16">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6 leading-tight">
                Ready to turn your data into <span className="text-blue-400">growth?</span>
              </h2>
              <p className="text-slate-300 max-w-md mb-6 leading-relaxed text-lg">
                I'm currently accepting new opportunities for full-time roles and freelance projects.
              </p>
              <ul className="text-slate-400 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>ETL pipelines & data automation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Interactive dashboards & BI solutions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Database optimization & architecture</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-8">
              {/* Navigation and Connect Grid */}
              <div className="grid grid-cols-2 gap-10">
                <div>
                  <h4 className="font-bold mb-6 text-slate-200">Navigation</h4>
                  <ul className="space-y-4 text-slate-400">
                    <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                    <li><a href="#skills" className="hover:text-white transition-colors">Skills</a></li>
                    <li><a href="#experience" className="hover:text-white transition-colors">Experience</a></li>
                    <li><a href="#projects" className="hover:text-white transition-colors">Projects</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold mb-6 text-slate-200">Connect</h4>
                  <ul className="space-y-4 text-slate-400">
                    <li>
                      <a href={linkedInUrl} target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                        <LinkedInIcon size={16} />
                        LinkedIn
                      </a>
                    </li>
                    <li>
                      <a href={githubUrl} target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        GitHub
                      </a>
                    </li>
                    <li>
                      <a href={`mailto:${emailText}`} className="hover:text-white transition-colors flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={scheduleCallUrl}
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
                >
                  <Mail className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  Start a Conversation
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href={linkedInUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
                >
                  <LinkedInIcon size={16} />
                  View LinkedIn
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-slate-500 text-sm">
              Designed and built by{' '}
              <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                Google AI Studio
              </a>
              {' '}and{' '}
              <a href="https://claude.ai" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                Claude Code
              </a>
            </div>

            <div className="flex gap-6">
              <a href={linkedInUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">
                <LinkedInIcon size={20} />
              </a>
              <a href={githubUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">
                <GitBranch className="w-5 h-5" />
              </a>
              <a href={`mailto:${emailText}`} className="text-slate-400 hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Utilities */}
      {/* AI Assistant disabled for GitHub Pages - requires backend proxy for secure API key handling */}
      {/* <AiAssistant /> */}

      {/* Scroll To Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-24 right-7 z-40 w-12 h-12 bg-white border border-slate-200 rounded-full shadow-lg flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all duration-500 transform ${
          showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'
        }`}
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      <AmaWidget chatbotIndexFile={chatbotIndexFile} />

    </div>
  );
};

export default App;
/**
 * Loads /site.json (from content/resume.md + content/portfolio.md).
 */

import { profileHandleFromUrl } from "./lib/profileHandleFromUrl.js";

function inlineBold(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Plain text with `segments` rendered as <code> (from portfolio.md ui.footerNote). */
function renderInlineCodeSpans(s) {
  return String(s)
    .split(/(`[^`]*`)/g)
    .map((part) => {
      if (
        part.length >= 2 &&
        part[0] === "`" &&
        part[part.length - 1] === "`"
      ) {
        return `<code>${esc(part.slice(1, -1))}</code>`;
      }
      return esc(part);
    })
    .join("");
}

function renderMarkdownBlock(text) {
  if (!text || !String(text).trim()) {
    return "";
  }
  const blocks = String(text).trim().split(/\n\n+/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim());
      const allBullets = lines.length > 0 && lines.every((l) => l.startsWith("- "));
      if (allBullets) {
        return `<ul class="prose-list">${lines
          .map((l) => `<li>${inlineBold(l.slice(2).trim())}</li>`)
          .join("")}</ul>`;
      }
      return `<p class="prose-portfolio">${inlineBold(block.replace(/\n+/g, " ").trim())}</p>`;
    })
    .join("");
}

async function loadData() {
  const base = import.meta.env.BASE_URL || "/";
  const url = `${base}site.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load site.json (${res.status}). Run: npm run sync`);
  }
  return res.json();
}

function renderContact(c) {
  const fields = [];
  if (c.phone) {
    fields.push(
      `<span class="contact-field"><span class="contact-label">phone:</span> <span class="contact-value phone">${esc(c.phone)}</span></span>`,
    );
  }
  if (c.email?.href) {
    fields.push(
      `<span class="contact-field"><span class="contact-label">email:</span> <a class="contact-value" href="${esc(c.email.href)}">${esc(c.email.text)}</a></span>`,
    );
  }
  if (c.linkedin?.href) {
    const linkedinDisplay =
      profileHandleFromUrl(c.linkedin.href) || c.linkedin.text || "LinkedIn";
    fields.push(
      `<span class="contact-field"><span class="contact-label">linkedin:</span> <a class="contact-value" href="${esc(c.linkedin.href)}" rel="noopener noreferrer" target="_blank">${esc(linkedinDisplay)}</a></span>`,
    );
  }
  if (c.github?.href) {
    const githubDisplay =
      profileHandleFromUrl(c.github.href) || c.github.text || "GitHub";
    fields.push(
      `<span class="contact-field"><span class="contact-label">github:</span> <a class="contact-value" href="${esc(c.github.href)}" rel="noopener noreferrer" target="_blank">${esc(githubDisplay)}</a></span>`,
    );
  }
  if (c.portfolio?.href) {
    const portfolioDisplay =
      (c.portfolio.text && String(c.portfolio.text).trim()) ||
      profileHandleFromUrl(c.portfolio.href) ||
      "Portfolio";
    fields.push(
      `<span class="contact-field"><span class="contact-label">portfolio:</span> <a class="contact-value" href="${esc(c.portfolio.href)}" rel="noopener noreferrer" target="_blank">${esc(portfolioDisplay)}</a></span>`,
    );
  }
  return `<div class="contact-row contact-row--labeled">${fields.join("")}</div>`;
}

function renderExperience(jobs) {
  return jobs
    .map(
      (job) => `
      <article class="experience-card experience-card--story">
        <h3>${esc(job.displayTitle || job.title)}</h3>
        <p class="experience-meta">
          ${["company", "location", "dates"]
            .map((k) => {
              const v = job[k];
              if (!v || !String(v).trim()) return "";
              return k === "company"
                ? `<strong>${esc(v)}</strong>`
                : esc(v);
            })
            .filter(Boolean)
            .join(" &middot; ")}
        </p>
        <ul>
          ${job.bullets.map((b) => `<li>${inlineBold(b)}</li>`).join("")}
        </ul>
      </article>`,
    )
    .join("");
}

function renderEducation(rows) {
  return `<ul class="edu-list">
    ${rows
      .map(
        (r) => `
      <li>
        <span class="edu-year">${esc(r.year)}</span>
        <span class="edu-school">${esc(r.school)}</span>
        <span class="edu-detail">${esc(r.detail)}</span>
      </li>`,
      )
      .join("")}
  </ul>`;
}

function renderSkills(rows) {
  return `<div class="skills-grid">
    ${rows
      .map(
        (r) => `
      <div class="skill-card">
        <h3>${esc(r.label)}</h3>
        <p>${esc(r.value)}</p>
      </div>`,
      )
      .join("")}
  </div>`;
}

function renderImpactStrip(text) {
  if (!text || !String(text).trim()) {
    return "";
  }
  const lines = String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "));
  if (!lines.length) {
    return `<div class="metrics-bento">${renderMarkdownBlock(text)}</div>`;
  }
  return `<ul class="metrics-strip">
    ${lines.map((l) => `<li class="metric-pill">${inlineBold(l.slice(2).trim())}</li>`).join("")}
  </ul>`;
}

function render(data) {
  const p = data.portfolio || {};
  const u = data.ui && typeof data.ui === "object" ? data.ui : {};
  const heroTagline =
    (u.heroTagline && String(u.heroTagline).trim()) ||
    (data.heroTagline && String(data.heroTagline).trim()) ||
    "";

  const pdfBtn = data.pdfAvailable
    ? `<a class="btn btn--ghost" href="${import.meta.env.BASE_URL}resume.pdf" download>${esc(u.pdfButton || "Download PDF resume")}</a>`
    : "";

  return `
    <header class="site-header">
      <div class="site-header__inner">
        <p class="eyebrow">${esc(u.eyebrow || "Portfolio")}</p>
        <h1>${esc(data.name)}</h1>
        <p class="tagline">${esc(heroTagline)}</p>
        <div class="header-actions">
          ${pdfBtn}
        </div>
      </div>
    </header>
    <main id="main">
      ${
        p.aboutMe
          ? `<section class="section-card" aria-labelledby="about-heading">
        <h2 id="about-heading" class="section-title">${esc(u.aboutMeHeading || "About me")}</h2>
        ${renderMarkdownBlock(p.aboutMe)}
      </section>`
          : ""
      }
      ${
        p.whatIDoBest
          ? `<section class="section-card" aria-labelledby="best-heading">
        <h2 id="best-heading" class="section-title">${esc(u.whatIDoBestHeading || "What I do best")}</h2>
        ${renderMarkdownBlock(p.whatIDoBest)}
      </section>`
          : ""
      }
      ${
        p.impactAtAGlance
          ? `<section class="section-card" aria-labelledby="impact-heading">
        <h2 id="impact-heading" class="section-title">${esc(u.impactAtAGlanceHeading || "Impact at a glance")}</h2>
        ${renderImpactStrip(p.impactAtAGlance)}
      </section>`
          : ""
      }
      <section aria-labelledby="exp-heading">
        <h2 id="exp-heading" class="section-title">${esc(u.workHighlightsHeading || "Work highlights")}</h2>
        ${
          u.workHighlightsLede && String(u.workHighlightsLede).trim()
            ? `<p class="section-lede">${esc(String(u.workHighlightsLede).trim())}</p>`
            : ""
        }
        ${renderExperience(data.experience)}
      </section>
      ${
        data.projects && data.projects.length
          ? `<section aria-labelledby="proj-heading">
        <h2 id="proj-heading" class="section-title">${esc(u.projectsHeading || "Projects")}</h2>
        ${renderExperience(data.projects)}
      </section>`
          : ""
      }
      <section class="two-col-wrap" aria-label="${esc(u.twoColAriaLabel || "Education and tools")}">
        <div class="two-col">
          <div>
            <h2 id="edu-heading" class="section-title">${esc(u.educationHeading || "Education")}</h2>
            ${renderEducation(data.education)}
          </div>
          <div>
            <h2 id="skills-heading" class="section-title">${esc(u.toolsAndStackHeading || "Tools and stack")}</h2>
            ${renderSkills(data.skills)}
          </div>
        </div>
      </section>
      ${
        p.letsConnect
          ? `<section class="connect-band" aria-labelledby="connect-heading">
        <h2 id="connect-heading" class="section-title section-title--on-dark">${esc(u.letsConnectHeading || "Let's connect")}</h2>
        ${renderMarkdownBlock(p.letsConnect)}
        <div class="connect-band__links">${renderContact(data.contact)}</div>
      </section>`
          : ""
      }
    </main>
    ${
      u.footerNote && String(u.footerNote).trim()
        ? `<footer class="site-footer"><p>${renderInlineCodeSpans(String(u.footerNote).trim())}</p></footer>`
        : ""
    }
  `;
}

async function main() {
  const app = document.getElementById("app");
  try {
    const data = await loadData();
    document.title = data.meta?.title || data.name || "Portfolio";
    const meta = document.querySelector('meta[name="description"]');
    if (meta && data.meta?.description) {
      meta.setAttribute("content", data.meta.description);
    }
    app.innerHTML = render(data);
  } catch (e) {
    app.innerHTML = `
      <main class="site-header" style="background:#450a0a;color:#fecaca;">
        <div class="site-header__inner">
          <h1>Could not load site</h1>
          <p>${esc(String(e.message))}</p>
          <p>From <code>portfolio/</code> run: <code>npm install</code> then <code>npm run sync</code> then <code>npm run dev</code></p>
        </div>
      </main>`;
    console.error(e);
  }
}

main();

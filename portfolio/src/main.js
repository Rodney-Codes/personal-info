/**
 * Loads workflow-selected site data JSON.
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
  // Bust GitHub Pages / Fastly edge cache (max-age on JSON/HTML) after each deploy.
  // Set VITE_SITE_DATA_BUST in CI (e.g. github.sha). Omitted locally -> same URL as before.
  const bustParam = import.meta.env.VITE_SITE_DATA_BUST
    ? `?v=${encodeURIComponent(String(import.meta.env.VITE_SITE_DATA_BUST))}`
    : "";
  const runtimeUrl = `${base}workflow.runtime.json${bustParam}`;
  const runtimeRes = await fetch(runtimeUrl, { cache: "no-store" });
  if (!runtimeRes.ok) {
    throw new Error(
      `Could not load workflow.runtime.json (${runtimeRes.status}). Run: npm run sync`,
    );
  }
  const runtime = await runtimeRes.json();
  const siteFile = runtime?.site_json_file;
  const pdfFile = runtime?.resume_pdf_file;
  if (
    !siteFile ||
    typeof siteFile !== "string" ||
    !siteFile.trim() ||
    !pdfFile ||
    typeof pdfFile !== "string" ||
    !pdfFile.trim()
  ) {
    throw new Error("workflow.runtime.json is missing required output filenames");
  }
  const siteUrl = `${base}${siteFile}${bustParam}`;
  const res = await fetch(siteUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not load ${siteFile} (${res.status}). Run: npm run sync`);
  }
  const data = await res.json();
  const selected =
    runtime.selected && typeof runtime.selected === "object"
      ? runtime.selected
      : null;
  return {
    data,
    runtime: {
      pdfFile,
      profileId: runtime.profile_id,
      selected,
    },
  };
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

function parseImpactCards(text) {
  if (!text || !String(text).trim()) {
    return [];
  }
  const lines = String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
  return lines.map((line) => {
    const m = line.match(/^(\*\*[^*]+\*\*|[0-9]+(?:\.[0-9]+)?[%+A-Za-z]*)\s*(.*)$/);
    if (!m) {
      return { value: "", label: line };
    }
    return {
      value: m[1].replace(/\*\*/g, "").trim(),
      label: m[2] ? m[2].trim() : "Impact",
    };
  });
}

function renderProjectsFormat2(projects) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const categories = [
    "All",
    ...new Set(
      safeProjects
        .map((p) => (p?.company && String(p.company).trim() ? String(p.company).trim() : "General"))
        .filter(Boolean),
    ),
  ];
  const filters = `<div class="f2-filters">${categories
    .map(
      (c, idx) =>
        `<button class="f2-filter-btn${idx === 0 ? " is-active" : ""}" data-filter="${esc(c)}">${esc(c)}</button>`,
    )
    .join("")}</div>`;
  const cards = safeProjects
    .map((project) => {
      const cat = project?.company && String(project.company).trim() ? String(project.company).trim() : "General";
      const tech = project?.location && String(project.location).trim() ? String(project.location).trim() : "";
      const bullets = Array.isArray(project?.bullets) ? project.bullets : [];
      return `<article class="f2-project-card f2-reveal" data-project-category="${esc(cat)}">
        <p class="f2-project-meta">${esc(cat)}${tech ? ` • ${esc(tech)}` : ""}${project?.dates ? ` • ${esc(project.dates)}` : ""}</p>
        <h3>${esc(project?.displayTitle || project?.title || "Project")}</h3>
        <ul>${bullets.map((b) => `<li>${inlineBold(String(b))}</li>`).join("")}</ul>
      </article>`;
    })
    .join("");
  return `${filters}<div class="f2-project-grid">${cards}</div>`;
}

function renderFormat1(data, runtime) {
  const p = data.portfolio || {};
  const u = data.ui && typeof data.ui === "object" ? data.ui : {};
  const heroTagline =
    (u.heroTagline && String(u.heroTagline).trim()) ||
    (data.heroTagline && String(data.heroTagline).trim()) ||
    "";

  const pdfBtn = data.pdfAvailable
    ? `<a class="btn btn--ghost" href="${import.meta.env.BASE_URL}${esc(runtime.pdfFile)}" onclick="this.download='rr_resume_'+Date.now()+'.pdf'">${esc(u.pdfButton || "Download PDF resume")}</a>`
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

function renderFormat2(data, runtime) {
  const p = data.portfolio || {};
  const u = data.ui && typeof data.ui === "object" ? data.ui : {};
  const heroTagline =
    (u.heroTagline && String(u.heroTagline).trim()) ||
    (data.heroTagline && String(data.heroTagline).trim()) ||
    "";
  const impactCards = parseImpactCards(p.impactAtAGlance);
  const pdfBtn = data.pdfAvailable
    ? `<a class="f2-btn f2-btn--ghost" href="${import.meta.env.BASE_URL}${esc(runtime.pdfFile)}" onclick="this.download='rr_resume_'+Date.now()+'.pdf'">${esc(u.pdfButton || "Download PDF resume")}</a>`
    : "";

  const skillPills = (data.skills || [])
    .map((s) => `<span class="f2-pill"><strong>${esc(s.label)}</strong> ${esc(s.value)}</span>`)
    .join("");

  return `
    <main id="main" class="f2-main">
      <section class="f2-hero f2-reveal">
        <p class="f2-kicker">${esc(u.eyebrow || "Portfolio")}</p>
        <h1>Hi, I'm <span>${esc(data.name.split(" ")[0] || data.name)}</span>.</h1>
        <h2>${esc(heroTagline || "I build data systems that get results.")}</h2>
        <p class="f2-summary">${esc(data.summary || "")}</p>
        <div class="f2-actions">
          ${pdfBtn}
          ${data.contact?.email?.href ? `<a class="f2-btn" href="${esc(data.contact.email.href)}">Schedule a Call</a>` : ""}
          ${data.contact?.linkedin?.href ? `<a class="f2-btn f2-btn--ghost" target="_blank" rel="noopener noreferrer" href="${esc(data.contact.linkedin.href)}">View Profile</a>` : ""}
        </div>
      </section>

      ${
        impactCards.length
          ? `<section class="f2-section">
        <h2>${esc(u.impactAtAGlanceHeading || "Results that matter")}</h2>
        <div class="f2-metric-grid">
          ${impactCards
            .map(
              (m) => `<article class="f2-metric-card f2-reveal">
              <p class="f2-metric-value">${esc(m.value || "Impact")}</p>
              <p class="f2-metric-label">${inlineBold(m.label || "")}</p>
            </article>`,
            )
            .join("")}
        </div>
      </section>`
          : ""
      }

      <section class="f2-section f2-reveal">
        <h2>${esc(u.toolsAndStackHeading || "Core Competencies")}</h2>
        <div class="f2-pill-wrap">${skillPills}</div>
      </section>

      <section class="f2-section">
        <h2>${esc(u.workHighlightsHeading || "Professional Journey")}</h2>
        <div class="f2-timeline">
          ${renderExperience(data.experience || [])
            .replaceAll('class="experience-card experience-card--story"', 'class="experience-card experience-card--story f2-timeline-card f2-reveal"')}
        </div>
      </section>

      ${
        data.projects && data.projects.length
          ? `<section class="f2-section">
          <h2>${esc(u.projectsHeading || "Featured Projects")}</h2>
          ${renderProjectsFormat2(data.projects)}
        </section>`
          : ""
      }
    </main>
  `;
}

function activateFormat2Interactions() {
  const filterButtons = Array.from(document.querySelectorAll(".f2-filter-btn"));
  const cards = Array.from(document.querySelectorAll(".f2-project-card"));
  for (const btn of filterButtons) {
    btn.addEventListener("click", () => {
      for (const b of filterButtons) {
        b.classList.remove("is-active");
      }
      btn.classList.add("is-active");
      const selected = btn.getAttribute("data-filter") || "All";
      for (const card of cards) {
        const category = card.getAttribute("data-project-category") || "";
        const show = selected === "All" || category === selected;
        card.style.display = show ? "" : "none";
      }
    });
  }

  const revealEls = Array.from(document.querySelectorAll(".f2-reveal"));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1 },
  );
  for (const el of revealEls) {
    observer.observe(el);
  }
}

async function main() {
  const app = document.getElementById("app");
  try {
    const { data, runtime } = await loadData();
    document.title = data.meta?.title || data.name || "Portfolio";
    const meta = document.querySelector('meta[name="description"]');
    if (meta && data.meta?.description) {
      meta.setAttribute("content", data.meta.description);
    }
    const variant = String(data?.ui?.templateVariant || "format1").toLowerCase();
    document.body.setAttribute("data-template", variant);
    if (variant === "format2") {
      const [{ default: React }, { createRoot }, { default: UpstreamApp }] = await Promise.all([
        import("react"),
        import("react-dom/client"),
        import("./format2/upstream/App.tsx"),
      ]);
      const root = createRoot(app);
      root.render(React.createElement(UpstreamApp, { data, runtime }));
      return;
    }
    app.innerHTML = renderFormat1(data, runtime);
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

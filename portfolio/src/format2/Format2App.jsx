import React, { useEffect, useMemo, useState } from "react";

import "./format2.css";

function linesFromText(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function bulletsFromText(text) {
  return linesFromText(text)
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

function renderInlineBold(text) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${idx}`}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>;
  });
}

function safeHttpUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.href;
  } catch {
    return "";
  }
}

function ProjectFilter({ projects }) {
  const categories = useMemo(
    () => [
      "All",
      ...new Set(
        projects
          .map((p) => (p.company && String(p.company).trim() ? String(p.company).trim() : "General"))
          .filter(Boolean),
      ),
    ],
    [projects],
  );
  const [active, setActive] = useState("All");
  const visible =
    active === "All"
      ? projects
      : projects.filter((p) => {
          const cat = p.company && String(p.company).trim() ? String(p.company).trim() : "General";
          return cat === active;
        });

  return (
    <>
      <div className="f2-filters">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`f2-filter-btn${active === cat ? " is-active" : ""}`}
            onClick={() => setActive(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="f2-project-grid">
        {visible.map((project, idx) => {
          const repoHref = safeHttpUrl(project.repoUrl);
          const titleLabel = project.displayTitle || project.title;
          return (
            <article className="f2-project-card f2-reveal" key={`${project.title}-${idx}`}>
              <p className="f2-project-meta">
                {project.company || "General"}
                {project.location ? ` • ${project.location}` : ""}
                {project.dates ? ` • ${project.dates}` : ""}
              </p>
              <h3>
                {repoHref ? (
                  <a href={repoHref} target="_blank" rel="noreferrer">
                    {titleLabel}
                  </a>
                ) : (
                  titleLabel
                )}
              </h3>
              <ul>
                {(project.bullets || []).map((b, bidx) => (
                  <li key={`${project.title}-${bidx}`}>{renderInlineBold(b)}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </>
  );
}

export default function Format2App({ data, runtime }) {
  const p = data?.portfolio || {};
  const u = data?.ui && typeof data.ui === "object" ? data.ui : {};
  const firstName = String(data?.name || "").split(/\s+/)[0] || "there";
  const heroTagline =
    (u.heroTagline && String(u.heroTagline).trim()) ||
    "I build data systems that get results.";
  const impactCards = bulletsFromText(p.impactAtAGlance).map((line) => {
    const m = line.match(/^(\*\*[^*]+\*\*|[0-9]+(?:\.[0-9]+)?[%+A-Za-z]*)\s*(.*)$/);
    if (!m) return { value: "", label: line };
    return { value: m[1].replace(/\*\*/g, ""), label: m[2] || "Impact" };
  });

  useEffect(() => {
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
    for (const el of revealEls) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <main id="main" className="f2-main">
      <section className="f2-hero f2-reveal">
        <p className="f2-kicker">{u.eyebrow || "Data Portfolio"}</p>
        <h1>
          Hi, I'm <span>{firstName}.</span>
        </h1>
        <h2>{heroTagline}</h2>
        <p className="f2-summary">{data.summary}</p>
        <div className="f2-actions">
          {data.pdfAvailable && (
            <a
              className="f2-btn f2-btn--ghost"
              href={`${import.meta.env.BASE_URL}${runtime.pdfFile}`}
              onClick={(e) => {
                e.currentTarget.download = `rr_resume_${Date.now()}.pdf`;
              }}
            >
              {u.pdfButton || "Download Resume PDF"}
            </a>
          )}
          {data?.contact?.email?.href && (
            <a className="f2-btn" href={data.contact.email.href}>
              Schedule a Call
            </a>
          )}
          {data?.contact?.linkedin?.href && (
            <a className="f2-btn f2-btn--ghost" href={data.contact.linkedin.href} target="_blank" rel="noreferrer">
              View Profile
            </a>
          )}
        </div>
      </section>

      {impactCards.length > 0 && (
        <section className="f2-section">
          <h2>{u.impactAtAGlanceHeading || "Results that matter"}</h2>
          <div className="f2-metric-grid">
            {impactCards.map((m, idx) => (
              <article className="f2-metric-card f2-reveal" key={`${m.value}-${idx}`}>
                <p className="f2-metric-value">{m.value || "Impact"}</p>
                <p className="f2-metric-label">{renderInlineBold(m.label)}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="f2-section f2-reveal">
        <h2>{u.toolsAndStackHeading || "Core Competencies"}</h2>
        <div className="f2-pill-wrap">
          {(data.skills || []).map((s, idx) => (
            <span className="f2-pill" key={`${s.label}-${idx}`}>
              <strong>{s.label}</strong> {s.value}
            </span>
          ))}
        </div>
      </section>

      <section className="f2-section">
        <h2>{u.workHighlightsHeading || "Professional Journey"}</h2>
        <div className="f2-timeline">
          {(data.experience || []).map((job, idx) => (
            <article className="experience-card experience-card--story f2-timeline-card f2-reveal" key={`${job.title}-${idx}`}>
              <h3>{job.displayTitle || job.title}</h3>
              <p className="experience-meta">
                {job.company ? <strong>{job.company}</strong> : ""}
                {job.location ? ` • ${job.location}` : ""}
                {job.dates ? ` • ${job.dates}` : ""}
              </p>
              <ul>
                {(job.bullets || []).map((b, bidx) => (
                  <li key={`${job.title}-${bidx}`}>{renderInlineBold(b)}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {Array.isArray(data.projects) && data.projects.length > 0 && (
        <section className="f2-section">
          <h2>{u.projectsHeading || "Featured Projects"}</h2>
          <ProjectFilter projects={data.projects} />
        </section>
      )}
    </main>
  );
}

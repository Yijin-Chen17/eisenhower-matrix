import { useEffect } from "react";
import { GUIDE_CONTENT } from "../lib/guide";
import type { Locale } from "../lib/i18n";

interface GuidePageProps {
  locale?: Locale;
  appVersion?: string;
  onBack: () => void;
}

export function GuidePage({ locale = "zh", appVersion = "0.1.0", onBack }: GuidePageProps) {
  const copy = GUIDE_CONTENT[locale];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  return (
    <div className="guide-page">
      <header className="guide-topbar">
        <button className="guide-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m14 6-6 6 6 6" />
          </svg>
          <span>{copy.back}</span>
        </button>
        <div className="guide-topbar-title">{copy.title}</div>
        <span className="guide-version">
          {copy.versionLabel} {appVersion}
        </span>
      </header>

      <div className="guide-scroll">
        <div className="guide-inner">
          <section className="guide-hero">
            <p className="guide-eyebrow">Eisenhower Matrix</p>
            <h1>{copy.title}</h1>
            <p className="guide-subtitle">{copy.subtitle}</p>
          </section>

          <nav className="guide-toc" aria-label={copy.tocLabel}>
            {copy.sections.map((section) => (
              <a key={section.id} href={`#/guide`} onClick={(event) => {
                event.preventDefault();
                document
                  .getElementById(`guide-${section.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>
                {section.title}
              </a>
            ))}
          </nav>

          {copy.sections.map((section) => (
            <section
              key={section.id}
              id={`guide-${section.id}`}
              className="guide-section"
            >
              <p className="guide-eyebrow">{section.eyebrow}</p>
              <h2>{section.title}</h2>
              <p className="guide-lead">{section.lead}</p>
              <div className="guide-grid">
                {section.items.map((item) => (
                  <article className="guide-card" key={item.title}>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <footer className="guide-footer">
            <button className="guide-cta" onClick={onBack}>
              {copy.back}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type MouseEventHandler, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LuArrowLeft, LuList } from "react-icons/lu";
import { useTheme } from "../../lib/themeContext";

export type LegalSection = {
  id: string;
  heading: string;
  content: ReactNode;
};

const CONTENT_CLASS =
  "mt-4 space-y-4 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300 " +
  "[&_p]:leading-relaxed [&_li]:leading-relaxed " +
  "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 " +
  "[&_strong]:font-semibold [&_strong]:text-neutral-900 dark:[&_strong]:text-white " +
  "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-brand-dark";

export function LegalPageLayout({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro?: ReactNode;
  sections: LegalSection[];
}) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(sections[0]?.id);

  useEffect(() => {
    const update = () => {
      const offset = 120;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) current = s.id;
        else break;
      }
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) current = sections[sections.length - 1]?.id;
      setActiveId(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  const tocLinks = (onNavigate?: MouseEventHandler<HTMLAnchorElement>) => (
    <ol className="space-y-0.5 text-sm">
      {sections.map((s, i) => {
        const active = activeId === s.id;
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={onNavigate}
              aria-current={active ? "true" : undefined}
              className={`flex gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
                active
                  ? "font-medium text-neutral-900 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <span className="tabular-nums text-neutral-400">{i + 1}.</span>
              <span>{s.heading}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-black/80">
        <button
          onClick={() => navigate(-1)}
          className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Back"
        >
          <LuArrowLeft className="h-5 w-5" />
        </button>
        <img
          src={theme === "dark" ? "/logo-white.svg" : "/logo-black.svg"}
          alt="Socially"
          className="h-6 w-6"
        />
        <h1 className="text-lg font-semibold sm:text-xl">{title}</h1>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 lg:py-12">
        <aside className="hidden lg:block">
          <nav aria-label="Table of contents" className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <p className="mb-3 px-2.5 text-sm font-medium text-neutral-500 dark:text-neutral-400">On this page</p>
            {tocLinks()}
          </nav>
        </aside>

        <main className="min-w-0">
          <p className="text-sm text-neutral-400">Last updated {updated}</p>
          {intro && (
            <div className="mt-4 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-brand-dark [&_strong]:font-semibold [&_strong]:text-neutral-900 dark:[&_strong]:text-white">
              {intro}
            </div>
          )}

          <details className="group mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
              <LuList className="h-4 w-4" />
              On this page
            </summary>
            <div className="border-t border-neutral-200 px-2 py-2 dark:border-neutral-800">
              {tocLinks((e) => {
                (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
              })}
            </div>
          </details>

          <div className="mt-8 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 p-6 sm:p-8">
                <h2 className="flex items-baseline gap-2.5 text-lg font-semibold text-neutral-900 dark:text-white">
                  <span className="tabular-nums text-neutral-400">{i + 1}.</span>
                  <span>{s.heading}</span>
                </h2>
                <div className={CONTENT_CLASS}>{s.content}</div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

/** Applies the theme immediately and remembers it in a cookie so the server renders it next time. */
function persistTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the server-rendered attribute once
    setTheme((document.documentElement.dataset.theme as Theme) ?? "dark");
  }, []);
  const apply = (t: Theme) => {
    setTheme(t);
    persistTheme(t);
  };
  const opts: { t: Theme; Icon: typeof Sun; label: string }[] = [
    { t: "dark", Icon: Moon, label: "Dark" },
    { t: "light", Icon: Sun, label: "Light" },
    { t: "system", Icon: Monitor, label: "System" },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-md border border-line p-0.5">
      {opts.map(({ t, Icon, label }) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          title={label}
          onClick={() => apply(t)}
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-[12px] ${theme === t ? "bg-hover text-fg" : "text-faint hover:text-fg"}`}
        >
          <Icon size={13} aria-hidden />
          {compact ? <span className="sr-only">{label}</span> : label}
        </button>
      ))}
    </div>
  );
}

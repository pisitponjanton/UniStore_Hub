"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useThemePreference, type ThemePreference } from "./theme-provider";
import styles from "./theme-switcher.module.css";

const modes = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
] as const;

export function ThemeSwitcher({ placement = "up", compact = false }: {
  placement?: "up" | "down";
  compact?: boolean;
}) {
  // Do not expose clickable controls until React has attached event handlers.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { preference, setPreference } = useThemePreference();
  const details = useRef<HTMLDetailsElement>(null);
  const CurrentIcon = modes.find(mode => mode.id === preference)?.Icon ?? Monitor;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !details.current?.open) return;
      event.preventDefault();
      details.current.open = false;
      details.current.querySelector<HTMLElement>("summary")?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (details.current?.open && target instanceof Node && !details.current.contains(target)) {
        details.current.open = false;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  function choose(mode: ThemePreference) {
    setPreference(mode);
    details.current?.removeAttribute("open");
    details.current?.querySelector<HTMLElement>("summary")?.focus();
  }

  if (!hydrated) return null;

  return (
    <details ref={details} className={styles.switcher} data-placement={placement} data-compact={compact || undefined}>
      <summary aria-label="เปลี่ยนธีม" title="เปลี่ยนธีม Light / Dark / System">
        <CurrentIcon size={17} aria-hidden="true" />
        {!compact ? <span>ธีม: {modes.find(mode => mode.id === preference)?.label}</span> : null}
        {!compact ? <ChevronDown size={14} aria-hidden="true" /> : null}
      </summary>
      <div className={styles.menu} role="group" aria-label="เลือกธีมของเว็บไซต์">
        {modes.map(({ id, label, Icon }) => (
          <button key={id} type="button" aria-pressed={preference === id} onClick={() => choose(id)}>
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
            {preference === id ? <Check size={15} className={styles.check} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </details>
  );
}

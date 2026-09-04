import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { X, ChevronDown, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTeamTagSuggestions } from "./hooks/use-team-tag-suggestions.js";

/**
 * A selected team tag. `code` is the RCM_TEAM_TAG concept code persisted on the
 * team (what the BE expects); `display` is the human-readable label shown to the
 * user. For custom (free-typed) tags both fields hold the typed value.
 */
export interface TeamTag {
  code: string;
  display: string;
}

export interface TeamTagsAutocompleteProps {
  value: TeamTag[];
  onChange: (tags: TeamTag[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Imperative handle letting an external "Add Tag" button open/focus the picker. */
export interface TeamTagsAutocompleteHandle {
  open: () => void;
}

type NavOption = { kind: "custom" } | { kind: "suggestion"; tag: TeamTag };

/**
 * Multi-select autocomplete for team tags. Options come from the RCM_TEAM_TAG
 * code system (via `useTeamTagSuggestions`); users can also type a custom value
 * and press Enter to add it. Supports arrow-key navigation over the dropdown and
 * a one-click "clear all". Renders each tag's display label while emitting its code.
 */
export const TeamTagsAutocomplete = forwardRef<
  TeamTagsAutocompleteHandle,
  TeamTagsAutocompleteProps
>(function TeamTagsAutocomplete({ value, onChange, placeholder = "Add tags…", disabled }, ref) {
  const { t } = useTranslation("provider");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { search, setSearch, selectedCodes, loading, suggestions, canAddCustom, trimmed } =
    useTeamTagSuggestions(value, onChange, open);

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        if (disabled) return;
        setOpen(true);
        inputRef.current?.focus();
      },
    }),
    [disabled]
  );

  const navOptions = useMemo<NavOption[]>(() => {
    const options: NavOption[] = [];
    if (canAddCustom) options.push({ kind: "custom" });
    suggestions.forEach((tag) => options.push({ kind: "suggestion", tag }));
    return options;
  }, [canAddCustom, suggestions]);

  const addTag = (tag: TeamTag) => {
    const code = tag.code.trim();
    if (!code || selectedCodes.has(code)) return;
    onChange([...value, { code, display: tag.display.trim() || code }]);
    setSearch("");
    setHighlightedIndex(-1);
  };

  const removeTag = (code: string) => {
    onChange(value.filter((t) => t.code !== code));
  };

  const clearAll = () => {
    onChange([]);
    setSearch("");
    setHighlightedIndex(-1);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightedIndex((i) =>
        navOptions.length === 0 ? -1 : i + 1 >= navOptions.length ? 0 : i + 1
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return;
      setHighlightedIndex((i) =>
        navOptions.length === 0 ? -1 : i <= 0 ? navOptions.length - 1 : i - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = highlightedIndex >= 0 ? navOptions[highlightedIndex] : undefined;
      if (active?.kind === "suggestion") {
        addTag(active.tag);
      } else if (trimmed) {
        addTag({ code: trimmed, display: trimmed });
      }
    } else if (e.key === "Backspace" && !search && value.length > 0) {
      removeTag(value[value.length - 1]!.code);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex flex-wrap items-center gap-1.5 min-h-[38px] w-full px-2 py-1.5 rounded-xl border bg-white dark:bg-dark-surface transition-colors ${
          open
            ? "border-primary ring-1 ring-primary/20"
            : "border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-slate-600"
        } ${disabled ? "opacity-60 pointer-events-none" : "cursor-text"}`}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {value.map((tag) => (
          <span
            key={tag.code}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary dark:text-primary-300 px-1.5 py-0.5 text-xs font-semibold"
          >
            {tag.display}
            <button
              type="button"
              className="text-primary/70 hover:text-primary dark:text-primary-300/70 dark:hover:text-primary-300"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag.code);
              }}
              aria-label={t("masterData.teams.tagsRemoveOne", {
                defaultValue: "Remove {{tag}}",
                tag: tag.display,
              })}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setHighlightedIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={disabled}
          role="searchbox"
          aria-autocomplete="list"
          className="flex-1 min-w-[100px] bg-transparent text-sm text-slate-900 dark:text-dark-text placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
        />
        {value.length > 0 && !disabled && (
          <button
            type="button"
            title={t("masterData.teams.tagsClearAll", "Clear all tags")}
            aria-label={t("masterData.teams.tagsClearAll", "Clear all tags")}
            className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown
          size={16}
          className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
              <Loader2 size={12} className="animate-spin" />
              {t("masterData.teams.tagsLoading", "Loading tags…")}
            </div>
          )}
          {!loading && suggestions.length === 0 && !canAddCustom && (
            <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
              {trimmed
                ? t("masterData.teams.tagsNoMatches", "No matching tags")
                : t("masterData.teams.tagsTypeToSearch", "Type to search or add a tag")}
            </div>
          )}
          {canAddCustom && (
            <button
              type="button"
              role="option"
              aria-selected={highlightedIndex === 0}
              className={`w-full text-left px-3 py-2 text-xs font-semibold text-primary dark:text-primary-300 flex items-center justify-between ${
                highlightedIndex === 0
                  ? "bg-primary/10 dark:bg-primary/15"
                  : "hover:bg-primary/5 dark:hover:bg-primary/10"
              }`}
              onMouseEnter={() => setHighlightedIndex(0)}
              onClick={() => addTag({ code: trimmed, display: trimmed })}
            >
              <span>
                {t("masterData.teams.tagsAddCustomPrefix", "Add")} &ldquo;
                <span className="font-bold">{trimmed}</span>&rdquo;
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Enter</span>
            </button>
          )}
          {suggestions.map((s, i) => {
            const navIndex = canAddCustom ? i + 1 : i;
            const isHighlighted = highlightedIndex === navIndex;
            return (
              <button
                key={s.code}
                type="button"
                role="option"
                aria-selected={isHighlighted}
                className={`w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 ${
                  isHighlighted
                    ? "bg-slate-50 dark:bg-dark-hover"
                    : "hover:bg-slate-50 dark:hover:bg-dark-hover"
                }`}
                onMouseEnter={() => setHighlightedIndex(navIndex)}
                onClick={() => addTag(s)}
              >
                {s.display}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

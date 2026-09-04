import React, { useState, useCallback, useRef } from "react";
import { X } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Parse a comma-separated tag string into an array of trimmed, unique tags */
export function parseTags(tagString: string | null | undefined): string[] {
  if (!tagString) return [];
  return [
    ...new Set(
      tagString
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    ),
  ];
}

/** Serialize an array of tags into a comma-separated string */
export function serializeTags(tags: string[] | null | undefined): string {
  if (!Array.isArray(tags) || tags.length === 0) return "";
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(",");
}

// ── Component ────────────────────────────────────────────────────────────

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Free-text tag entry — type and press Enter to add, Backspace on an empty
 * input to remove the last tag. Tags are de-duplicated case-insensitively.
 */
export function TagInput({ tags, onChange, placeholder, disabled = false }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed && !tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        onChange([...tags, trimmed]);
      }
      setInputValue("");
      inputRef.current?.focus();
    },
    [tags, onChange]
  );

  const removeTag = useCallback(
    (idx: number) => {
      onChange(tags.filter((_, i) => i !== idx));
    },
    [tags, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag(inputValue);
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        // Remove last tag when pressing backspace with empty input
        removeTag(tags.length - 1);
      }
    },
    [inputValue, tags, addTag, removeTag]
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-bg px-2.5 py-2 min-h-[40px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
      {tags.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? (placeholder ?? "Type and press Enter...") : ""}
        disabled={disabled}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-900 dark:text-dark-text placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none border-none p-0"
      />
    </div>
  );
}

export type { TagInputProps };

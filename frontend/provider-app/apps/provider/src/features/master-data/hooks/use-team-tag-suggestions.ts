import { useEffect, useMemo, useState } from "react";
import { useSystemCodesAutocompleteQuery, CodeSystemCode } from "@/__generated__/graphql";

import type { TeamTag } from "../team-tags-autocomplete.js";

export interface UseTeamTagSuggestionsResult {
  /** Current search text typed into the picker's input. */
  search: string;
  /** Updates the search text; also drives the debounced remote query. */
  setSearch: (value: string) => void;
  /** Codes already selected, for cheap membership checks. */
  selectedCodes: Set<string>;
  /** True while the remote suggestion query is in flight. */
  loading: boolean;
  /** Remote tags matching `search`, excluding tags already in `value`. */
  suggestions: TeamTag[];
  /** True when the trimmed search text can be added as a new custom tag. */
  canAddCustom: boolean;
  /** `search` with surrounding whitespace removed. */
  trimmed: string;
}

/**
 * Fetches RCM_TEAM_TAG suggestions for `TeamTagsAutocomplete`, debounced by search text, and
 * resolves display labels for tags that were loaded with only a code (e.g. a persisted team's
 * tag codes). `open` gates both queries so nothing fetches until the picker is opened.
 */
export function useTeamTagSuggestions(
  value: TeamTag[],
  onChange: (tags: TeamTag[]) => void,
  open: boolean
): UseTeamTagSuggestionsResult {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const { data, loading } = useSystemCodesAutocompleteQuery({
    variables: {
      first: 20,
      filter: {
        codeSystemCode: CodeSystemCode.RcmTeamTag,
        ...(debouncedSearch ? { keyword: debouncedSearch } : {}),
      },
    },
    skip: !open,
    fetchPolicy: "no-cache",
  });

  const selectedCodes = useMemo(() => new Set(value.map((t) => t.code)), [value]);

  // Resolve display labels for tags loaded with only a code (e.g. an existing team's
  // persisted tag codes, whose display defaults to the code). Team tags are a small
  // controlled vocabulary, so a single bounded fetch covers them.
  const needsResolution = useMemo(() => value.some((t) => t.display === t.code), [value]);
  const { data: resolveData } = useSystemCodesAutocompleteQuery({
    variables: {
      first: 200,
      filter: { codeSystemCode: CodeSystemCode.RcmTeamTag },
    },
    skip: !needsResolution,
    fetchPolicy: "no-cache",
  });
  const codeToDisplay = useMemo(() => {
    const map = new Map<string, string>();
    resolveData?.codeSystemConcepts?.edges?.forEach((e) => {
      const node = e?.node;
      if (node?.code) {
        map.set(node.code, (node.display ?? node.arabicDisplay ?? node.code).trim());
      }
    });
    return map;
  }, [resolveData]);

  useEffect(() => {
    if (codeToDisplay.size === 0) return;
    let changed = false;
    const next = value.map((tag) => {
      if (tag.display === tag.code) {
        const display = codeToDisplay.get(tag.code);
        if (display && display !== tag.display) {
          changed = true;
          return { ...tag, display };
        }
      }
      return tag;
    });
    if (changed) onChange(next);
  }, [codeToDisplay, value, onChange]);

  const suggestions = useMemo<TeamTag[]>(() => {
    const nodes =
      data?.codeSystemConcepts?.edges
        ?.map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => !!n) ?? [];
    return nodes
      .map((n) => ({
        code: (n.code ?? "").trim(),
        display: (n.display ?? n.arabicDisplay ?? n.code ?? "").trim(),
      }))
      .filter((tag) => tag.code && !selectedCodes.has(tag.code));
  }, [data, selectedCodes]);

  const trimmed = search.trim();
  const canAddCustom =
    trimmed.length > 0 &&
    !selectedCodes.has(trimmed) &&
    !value.some((t) => t.display.toLowerCase() === trimmed.toLowerCase()) &&
    !suggestions.some((s) => s.display.toLowerCase() === trimmed.toLowerCase());

  return { search, setSearch, selectedCodes, loading, suggestions, canAddCustom, trimmed };
}

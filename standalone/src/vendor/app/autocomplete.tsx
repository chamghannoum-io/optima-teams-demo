/**
 * Stands in for @/shared/autocomplete and @/autocompletes.
 *
 * The real ApiAutocomplete drives a paginated GraphQL-backed picker; this keeps the
 * same props and option shape so the real drawers work, backed by the local schema.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@apollo/client";
import { Input } from "../ui/index.js";
import type { IBaseOption } from "./shared.js";

import { BranchesAutocompleteDocument, SystemCodesAutocompleteDocument } from "./generated.js";

/**
 * Config the drawers pass to ApiAutocomplete. Real shape: each entry names the
 * document, where the rows live in the response, and how to map a row to an option.
 */
export const autocompleteQueriesMapper: Record<string, any> = {
  branch: {
    queryConfig: {
      document: BranchesAutocompleteDocument,
      dataPath: "branches",
      variables: { first: 100 },
    },
    mapToOption: (n: any) => ({ key: String(n.id), label: n.name ?? String(n.id), value: n }),
  },
  systemCodeDisplayOnly: {
    queryConfig: {
      document: SystemCodesAutocompleteDocument,
      dataPath: "codeSystemConcepts",
      variables: { first: 200 },
    },
    mapToOption: (n: any) => ({ key: n.code, label: n.display ?? n.code, value: n }),
  },
};

export function ApiAutocomplete({
  value,
  onChange,
  placeholder,
  options: given,
  multiple,
  disabled,
  queryConfig,
  mapToOption,
}: {
  queryConfig?: any;
  mapToOption?: (n: any) => IBaseOption;
  value?: any;
  onChange?: (v: any) => void;
  placeholder?: string;
  options?: IBaseOption[];
  multiple?: boolean;
  disabled?: boolean;
  [k: string]: any;
}) {
  const [q, setQ] = useState("");
  const { data } = useQuery(queryConfig?.document ?? BranchesAutocompleteDocument, {
    variables: queryConfig?.variables,
    skip: !queryConfig?.document,
  });
  const fetched: IBaseOption[] = useMemo(() => {
    if (!queryConfig?.dataPath || !data) return [];
    const conn = (data as any)[queryConfig.dataPath];
    const nodes = (conn?.edges ?? []).map((e: any) => e.node);
    return nodes.map(mapToOption ?? ((n: any) => ({ key: String(n.id ?? n.code), label: n.name ?? n.display ?? "", value: n })));
  }, [data, queryConfig, mapToOption]);
  const opts = given ?? fetched;
  const shown = useMemo(
    () => opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 50),
    [opts, q]
  );
  const selected: any[] = multiple ? (Array.isArray(value) ? value : []) : value ? [value] : [];

  return (
    <div className="space-y-1">
      <Input
        placeholder={placeholder ?? "Search…"}
        value={q}
        disabled={disabled}
        onChange={(e: any) => setQ(e.target.value)}
      />
      {q && (
        <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 dark:border-dark-border dark:bg-dark-card">
          {shown.map((o) => (
            <button
              key={o.key}
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-dark-hover"
              onClick={() => {
                onChange?.(multiple ? [...selected, o] : o);
                setQ("");
              }}
            >
              {o.label}
            </button>
          ))}
          {!shown.length && <p className="px-2 py-1 text-xs text-slate-500">No matches</p>}
        </div>
      )}
    </div>
  );
}
export default ApiAutocomplete;

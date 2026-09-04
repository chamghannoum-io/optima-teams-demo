import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  usePhoneInput,
  FlagImage,
  defaultCountries,
  parseCountry,
} from "react-international-phone";
import type { CountryIso2 } from "react-international-phone";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "./utils.js";

export interface PhoneInputProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  onBlur?: () => void;
  defaultCountry?: string;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  showDialCode?: boolean;
  className?: string;
  containerClassName?: string;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  defaultCountry = "sa",
  label,
  placeholder = "Phone number",
  error,
  disabled,
  showDialCode = false,
  className,
  containerClassName,
}: PhoneInputProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { inputValue, country, setCountry, handlePhoneValueChange } =
    usePhoneInput({
      value: value ?? undefined,
      defaultCountry: (defaultCountry as CountryIso2) ?? "sa",
      preferredCountries: ["ae", "sa", "ps"],
      onChange: (data) => {
        const localNumber = data?.phone
          ?.replace(`+${data?.country?.dialCode}`, "")
          ?.trim();
        onChange?.(localNumber ? data.phone : undefined);
      },
    });

  const filteredCountries = React.useMemo(() => {
    const q = search.toLowerCase();
    return defaultCountries
      .map(parseCountry)
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.dialCode.includes(q) ||
          c.iso2.includes(q)
      );
  }, [search]);

  const handleCountrySelect = (iso2: CountryIso2) => {
    setCountry(iso2);
    setOpen(false);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const isActive = focused || open;

  return (
    <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
      {label && (
        <label className="text-[10px] font-bold text-[#2D3670] dark:text-[#a5b1db] uppercase tracking-wider px-1">
          {label}
        </label>
      )}

      <div
        className={cn(
          "flex h-[40px] w-full rounded-md overflow-hidden",
          "border border-slate-200 dark:border-dark-border",
          "bg-white dark:bg-dark-surface",
          "transition-all duration-300",
          !disabled && "hover:border-slate-300 dark:hover:border-slate-600",
          isActive &&
            !error &&
            "border-primary ring-1 ring-primary/10",
          error && "border-red-500",
          isActive && error && "ring-1 ring-red-500/10",
          disabled && "bg-slate-50 dark:bg-dark-bg opacity-60 cursor-not-allowed",
          className
        )}
      >
        {/* Country selector */}
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex items-center gap-1.5 px-3 h-full shrink-0",
                "border-r border-slate-200 dark:border-dark-border",
                "text-slate-600 dark:text-dark-text-secondary",
                "hover:bg-slate-50 dark:hover:bg-white/5",
                "transition-colors duration-200",
                "focus:outline-none",
                disabled && "pointer-events-none"
              )}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            >
              <FlagImage iso2={country?.iso2 ?? "sa"} className="w-5 h-3.5 rounded-[2px] object-cover shrink-0" />
              {showDialCode && (
                <span className="text-[11px] font-medium tabular-nums">
                  +{country?.dialCode}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "w-3 h-3 text-slate-400 transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className={cn(
                "z-50 w-64 rounded-lg shadow-lg",
                "border border-slate-200 dark:border-dark-border",
                "bg-white dark:bg-dark-surface",
                "animate-in fade-in-0 zoom-in-95",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              )}
            >
              {/* Search */}
              <div className="p-2 border-b border-slate-100 dark:border-dark-border">
                <div className="flex items-center gap-2 px-2 h-8 rounded-md border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg">
                  <Search className="w-3 h-3 text-slate-400 shrink-0" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search country..."
                    className="flex-1 bg-transparent text-[11px] text-slate-900 dark:text-dark-text placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>

              {/* Country list */}
              <div className="max-h-52 overflow-y-auto py-1">
                {filteredCountries.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-slate-400">
                    No results
                  </p>
                ) : (
                  filteredCountries.map((c) => (
                    <button
                      key={c.iso2}
                      type="button"
                      onClick={() => handleCountrySelect(c.iso2 as CountryIso2)}
                      className={cn(
                        "flex items-center gap-2.5 w-full px-3 py-1.5",
                        "text-xs text-slate-700 dark:text-dark-text",
                        "hover:bg-slate-50 dark:hover:bg-white/5",
                        "transition-colors duration-150",
                        country?.iso2 === c.iso2 &&
                          "bg-primary/5 dark:bg-primary/10 text-primary dark:text-[#a5b1db] font-medium"
                      )}
                    >
                      <FlagImage
                        iso2={c.iso2}
                        className="w-5 h-3.5 rounded-[2px] object-cover shrink-0"
                      />
                      <span className="flex-1 text-left truncate">{c.name}</span>
                      <span className="text-[11px] tabular-nums text-slate-400 dark:text-dark-text-muted shrink-0">
                        +{c.dialCode}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Phone number input */}
        <input
          ref={inputRef}
          type="tel"
          value={inputValue}
          onChange={handlePhoneValueChange}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          className={cn(
            "flex-1 h-full px-3 bg-transparent",
            "text-xs text-slate-900 dark:text-dark-text",
            "placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:text-[11px]",
            "focus:outline-none",
            disabled && "cursor-not-allowed"
          )}
        />
      </div>

      {error && (
        <span className="text-[10px] font-medium text-red-500 px-1">
          {error}
        </span>
      )}
    </div>
  );
}

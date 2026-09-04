import * as React from "react";

declare module "react-international-phone" {
  export type CountryIso2 = string;

  // Raw country tuple: [name, iso2, dialCode, format?, priority?, areaCodes?]
  export type CountryData = [string, string, string, string?, number?, string[]?];

  export interface ParsedCountry {
    name: string;
    iso2: CountryIso2;
    dialCode: string;
    format?: string;
    priority?: number;
    areaCodes?: string[];
  }

  export const defaultCountries: CountryData[];

  export function parseCountry(countryData: CountryData): ParsedCountry;

  export interface FlagImageProps {
    iso2: CountryIso2;
    className?: string;
    style?: React.CSSProperties;
  }

  export const FlagImage: React.ComponentType<FlagImageProps>;

  export interface UsePhoneInputConfig {
    defaultCountry?: CountryIso2;
    value?: string;
    countries?: CountryData[];
    preferredCountries?: CountryIso2[];
    defaultMask?: string;
    prefix?: string;
    charAfterDialCode?: string;
    disableCountryGuess?: boolean;
    disableDialCodePrefill?: boolean;
    forceDialCode?: boolean;
    disableDialCodeAndPrefix?: boolean;
    disableFormatting?: boolean;
    allowMaskOverflow?: boolean;
    historySaveDebounceMS?: number;
    onChange?: (data: { phone: string; inputValue: string; country: ParsedCountry }) => void;
    inputRef?: React.MutableRefObject<HTMLInputElement | null>;
  }

  export function usePhoneInput(options: UsePhoneInputConfig): {
    phone: string;
    inputValue: string;
    country: ParsedCountry;
    setCountry: (countryIso2: CountryIso2, options?: { focusOnInput: boolean }) => void;
    handlePhoneValueChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => string;
    inputRef: React.MutableRefObject<HTMLInputElement | null>;
  };

  export interface LibraryPhoneInputProps {
    value?: string;
    defaultCountry?: CountryIso2;
    onChange?: (phone: string) => void;
    className?: string;
    inputClassName?: string;
    placeholder?: string;
  }

  export const PhoneInput: React.ComponentType<LibraryPhoneInputProps>;
}

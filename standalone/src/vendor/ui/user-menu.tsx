import type { ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "./utils.js";

export interface UserMenuItem {
  label: string | ReactNode;
  icon?: ReactNode | null;
  onClick: () => void;
}

export interface UserMenuProps {
  userName: string;
  items: UserMenuItem[];
  footerItems?: UserMenuItem[];
}

export function UserMenu({ userName, items, footerItems }: UserMenuProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-600 py-1.5 pl-2 pr-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <svg
            className="h-5 w-5 text-gray-500 dark:text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{userName}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-lg",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
          )}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={item.onClick}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {item.icon && (
                <span className="flex h-5 w-5 items-center justify-center text-gray-400">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}

          {footerItems && footerItems.length > 0 && (
            <>
              <div className="mx-2 my-1 border-t border-gray-200 dark:border-gray-700" />
              {footerItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {item.icon && (
                    <span className="flex h-5 w-5 items-center justify-center text-gray-400">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              ))}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

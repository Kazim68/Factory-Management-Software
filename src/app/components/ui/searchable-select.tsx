"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Input } from "./input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverAnchor, PopoverContent } from "./popover";
import { cn } from "./utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select option",
  searchPlaceholder = "Type to search...",
  emptyMessage = "No results found.",
  disabled = false,
  triggerClassName,
  contentClassName,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) =>
      [option.label, option.description, option.value]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery(selectedOption?.label ?? "");
    }
  }, [open, selectedOption]);

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const selectOption = (option: SearchableSelectOption) => {
    if (option.disabled) return;
    onValueChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            value={query}
            placeholder={open ? searchPlaceholder : placeholder}
            disabled={disabled}
            onFocus={() => {
              if (disabled) return;
              setOpen(true);
              window.setTimeout(() => inputRef.current?.select(), 0);
            }}
            onClick={() => {
              if (!disabled) setOpen(true);
            }}
            onChange={(event) => {
              if (disabled) return;
              setQuery(event.target.value);
              if (!open) setOpen(true);
            }}
            onKeyDown={(event) => {
              if (disabled) return;

              if (event.key === "Escape") {
                setOpen(false);
                setQuery(selectedOption?.label ?? "");
                inputRef.current?.blur();
                return;
              }

              if ((event.key === "ArrowDown" || event.key === "Enter") && !open) {
                event.preventDefault();
                setOpen(true);
                return;
              }

              if (
                event.key === "Enter" &&
                open &&
                filteredOptions.length === 1 &&
                !filteredOptions[0]?.disabled
              ) {
                event.preventDefault();
                selectOption(filteredOptions[0]);
              }
            }}
            className={cn("pr-9", triggerClassName)}
          />
          <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-50" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        portalled={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className={cn("z-[60] w-[var(--radix-popover-trigger-width)] p-0", contentClassName)}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {filteredOptions.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={[option.label, option.description].filter(Boolean).join(" ")}
                    onSelect={() => selectOption(option)}
                    disabled={option.disabled}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        option.value === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{option.label}</div>
                      {option.description ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

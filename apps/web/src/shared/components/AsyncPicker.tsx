import { Combobox } from "@base-ui/react/combobox";
import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuLoaderCircle, LuX } from "react-icons/lu";

import { cn } from "@/lib/utils";

/**
 * How long the picker waits after the last keystroke before searching, in milliseconds.
 */
const SEARCH_DELAY_MS = 250;

/**
 * Props of {@link AsyncPicker}.
 */
interface AsyncPickerProps<ItemT> {
  /** Selected option, or null. */
  value: ItemT | null;
  /** Receives the new selection, or null when cleared. */
  onChange: (value: ItemT | null) => void;
  /** Fetches the options matching what was typed; it runs on the server, never on a loaded list. */
  search: (text: string) => Promise<ItemT[]>;
  /** Unique key of an option. */
  getKey: (item: ItemT) => string;
  /** Main text of an option, also shown in the field once selected. */
  getLabel: (item: ItemT) => string;
  /** Secondary text of an option, if any. */
  getDescription?: (item: ItemT) => string;
  /** Text shown while nothing is selected. */
  placeholder?: string;
  /** Message when the search finds nothing. */
  emptyText?: string;
  /** Text that changes the source of the options; a change starts a new search. */
  scopeKey?: string;
  /** Disables the picker. */
  disabled?: boolean;
  /** Identifier set by `Field`, so the label names the input. */
  id?: string;
  /** Validation state set by `Field`. */
  "aria-invalid"?: boolean;
  /** Help and error ids set by `Field`. */
  "aria-describedby"?: string;
  /** Required state set by `Field`. */
  "aria-required"?: boolean;
  /** Accessible name when there is no visible label. */
  "aria-label"?: string;
  /** Extra classes of the wrapper. */
  className?: string;
}

/**
 * Searchable picker for large collections, such as clients or engines.
 *
 * Each keystroke, debounced, asks the server for matching options, so it never loads the whole
 * table. It follows the combobox pattern: the input announces the list, arrows move through the
 * options, Enter selects and Escape closes.
 *
 * @param props - Selection, search function, labels and accessibility props.
 * @returns The picker.
 */
export function AsyncPicker<ItemT>({
  value,
  onChange,
  search,
  getKey,
  getLabel,
  getDescription,
  placeholder = "Buscar...",
  emptyText = "No hay coincidencias.",
  scopeKey = "",
  disabled = false,
  className,
  ...inputProps
}: AsyncPickerProps<ItemT>) {
  const [open, setOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [items, setItems] = useState<ItemT[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const searchRef = useRef(search);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const request: number = ++requestRef.current;
    const timer: number = window.setTimeout(() => {
      setLoading(true);
      searchRef.current(query)
        .then((found) => {
          if (request === requestRef.current) {
            setItems(found);
          }
        })
        .catch(() => {
          if (request === requestRef.current) {
            setItems([]);
          }
        })
        .finally(() => {
          if (request === requestRef.current) {
            setLoading(false);
          }
        });
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [open, query, scopeKey]);

  const selectedLabel: string = value ? getLabel(value) : "";
  const options: ItemT[] = value && !items.some((item) => getKey(item) === getKey(value)) ? [value, ...items] : items;

  return (
    <Combobox.Root
      items={options}
      value={value}
      onValueChange={(next) => onChange((next as ItemT | null) ?? null)}
      onInputValueChange={(text) => setQuery(text === selectedLabel ? "" : text)}
      open={open}
      onOpenChange={setOpen}
      filter={null}
      itemToStringLabel={(item: ItemT) => getLabel(item)}
      isItemEqualToValue={(item: ItemT, selected: ItemT) => getKey(item) === getKey(selected)}
      disabled={disabled}
    >
      <div className={cn("relative", className)}>
        <Combobox.Input
          placeholder={placeholder}
          className="h-9 w-full min-w-0 rounded-md border border-input bg-panel pr-16 pl-3 text-[0.9375rem] text-fg outline-none placeholder:text-fg-faint focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20"
          {...inputProps}
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          {loading && <LuLoaderCircle aria-hidden className="mr-1 size-4 animate-spin text-fg-subtle" />}
          {value && !disabled && (
            <Combobox.Clear
              aria-label="Quitar selección"
              className="flex size-7 cursor-pointer items-center justify-center rounded-sm text-fg-subtle hover:bg-raised hover:text-fg"
            >
              <LuX aria-hidden className="size-4" />
            </Combobox.Clear>
          )}
          <Combobox.Trigger
            aria-label="Mostrar opciones"
            className="flex size-7 cursor-pointer items-center justify-center rounded-sm text-fg-subtle hover:bg-raised hover:text-fg disabled:cursor-not-allowed"
          >
            <LuChevronDown aria-hidden className="size-4" />
          </Combobox.Trigger>
        </div>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-50">
          <Combobox.Popup className="max-h-72 w-(--anchor-width) min-w-56 overflow-y-auto rounded-md border border-line bg-panel p-1 text-fg shadow-lg">
            <Combobox.Empty className="px-2.5 py-2 text-sm text-fg-subtle empty:hidden">
              {loading ? "Buscando..." : emptyText}
            </Combobox.Empty>
            <Combobox.List>
              {(item: ItemT) => (
                <Combobox.Item
                  key={getKey(item)}
                  value={item}
                  className="flex cursor-pointer flex-col rounded-sm px-2.5 py-1.5 text-sm outline-none select-none data-highlighted:bg-raised data-selected:font-semibold"
                >
                  <span className="text-fg">{getLabel(item)}</span>
                  {getDescription && <span className="text-xs text-fg-subtle">{getDescription(item)}</span>}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

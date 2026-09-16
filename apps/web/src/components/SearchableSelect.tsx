/**
 * SearchableSelect — a drop-in replacement for <select> that adds a search
 * input inside the dropdown. Works identically to a native select:
 *
 *   <SearchableSelect
 *     value={value}
 *     onChange={v => setValue(v)}
 *     options={["Option A", "Option B"]}
 *     placeholder="Select..."
 *     className="..."           // same className as the old <select>
 *   />
 *
 * options can be:
 *   string[]                    → value and label are the same
 *   { value: string; label: string }[]
 *
 * An empty string option ("") is always prepended using the placeholder text.
 * Keyboard: ArrowUp/Down navigate, Enter selects, Escape closes.
 */
import { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";

export type SelectOption =
  | string
  | { value: string; label: string };

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

function optVal(o: SelectOption) { return typeof o === "string" ? o : o.value; }
function optLbl(o: SelectOption) { return typeof o === "string" ? o : o.label; }

export function SearchableSelect({
  value, onChange, options, placeholder = "Select...", className = "", disabled, id,
}: Props) {
  const [open,     setOpen]     = useState(false);
  const [q,        setQ]        = useState("");
  const [focused,  setFocused]  = useState(-1);   // index in filtered list
  const [rect,     setRect]     = useState<DOMRect | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const listRef    = useRef<HTMLUListElement>(null);
  const uid        = useId();

  const allOptions: SelectOption[] = [{ value: "", label: placeholder }, ...options];
  const filtered = q
    ? allOptions.filter(o => optLbl(o).toLowerCase().includes(q.toLowerCase()))
    : allOptions;

  const selectedLabel = (() => {
    if (!value) return placeholder;
    const found = allOptions.find(o => optVal(o) === value);
    return found ? optLbl(found) : value;
  })();

  const openDropdown = () => {
    if (disabled) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setRect(r);
    setOpen(true);
    setQ("");
    setFocused(filtered.findIndex(o => optVal(o) === value));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const closeDropdown = () => { setOpen(false); setQ(""); setFocused(-1); };

  const pick = (v: string) => {
    onChange(v);
    closeDropdown();
    triggerRef.current?.focus();
  };

  // Recompute rect on scroll/resize so the portal stays aligned
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    };
    window.addEventListener("scroll",  update, true);
    window.addEventListener("resize",  update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const drop = document.getElementById(`ss-drop-${uid}`);
      if (drop && !drop.contains(e.target as Node) &&
          !triggerRef.current?.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keep focused item scrolled into view
  useEffect(() => {
    if (!open || focused < 0) return;
    listRef.current?.children[focused]?.scrollIntoView({ block: "nearest" });
  }, [focused, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDropdown(); } return; }
    if (e.key === "Escape")    { e.preventDefault(); closeDropdown(); }
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused(f => Math.min(f + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    if (e.key === "Enter" && focused >= 0) { e.preventDefault(); pick(optVal(filtered[focused]!)); }
  };

  const dropStyle: React.CSSProperties = rect
    ? {
        position:  "fixed",
        top:       rect.bottom + 2,
        left:      rect.left,
        width:     rect.width,
        zIndex:    9999,
      }
    : { display: "none" };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`ss-drop-${uid}`}
        onClick={openDropdown}
        onKeyDown={onKeyDown}
        className={`relative flex items-center justify-between text-left ${className} ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <span className={`truncate ${!value ? "text-gray-400" : ""}`}>
          {selectedLabel}
        </span>
        <svg
          className={`ml-1 w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && createPortal(
        <div
          id={`ss-drop-${uid}`}
          style={dropStyle}
          className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden"
        >
          {/* Search input */}
          <div className="p-1.5 border-b border-gray-100">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={e => { setQ(e.target.value); setFocused(0); }}
                onKeyDown={onKeyDown}
                placeholder="Search..."
                className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400 min-w-0"
              />
              {q && (
                <button onClick={() => { setQ(""); setFocused(-1); inputRef.current?.focus(); }}
                  className="text-gray-400 hover:text-gray-600">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Option list */}
          <ul ref={listRef} role="listbox" className="overflow-y-auto max-h-52 py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400 text-center">No results</li>
            ) : filtered.map((o, i) => {
              const v = optVal(o), l = optLbl(o);
              const isSelected = v === value;
              const isFocused  = i === focused;
              return (
                <li
                  key={v || "__empty__"}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setFocused(i)}
                  onMouseDown={e => { e.preventDefault(); pick(v); }}
                  className={`px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between ${
                    isFocused  ? "bg-indigo-50 text-indigo-700" :
                    isSelected ? "bg-gray-50 text-gray-900 font-medium" :
                    "text-gray-700 hover:bg-gray-50"
                  } ${!v ? "text-gray-400 text-xs" : ""}`}
                >
                  <span className="truncate">{l || <span className="italic">—</span>}</span>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Count */}
          <div className="px-3 py-1 border-t border-gray-50 text-[10px] text-gray-400">
            {filtered.length} of {allOptions.length} options
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Category } from "../domain/types";
import "./CategorySelect.css";

export function CategorySelect({ categories, value, onChange, label }: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = categories.find((category) => category.id === value);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = categories.filter((category) => {
    const text = `${category.label} ${category.group} ${category.description}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  const groups = [...new Set(matches.map((category) => category.group))];
  // Keyboard order follows the same grouped order as the rendered list.
  const options = groups.flatMap((group) => matches.filter((category) => category.group === group));
  const activeOption = options[active];

  useEffect(() => {
    input.current?.setCustomValidity(value ? "" : "Choose an issue type from the list.");
  }, [value]);
  useEffect(() => {
    if (open && activeOption)
      document.getElementById(`${id}-${activeOption.id}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeOption, id]);

  function show() {
    setQuery("");
    setActive(0);
    setOpen(true);
  }
  function choose(category: Category) {
    onChange(category.id);
    setQuery("");
    setOpen(false);
  }
  return <div className="category-select" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label htmlFor={id}>{label}</label>
    <div className="category-select-control">
      <input ref={input} id={id} role="combobox" type="text" required
        autoComplete="off" aria-autocomplete="list" aria-expanded={open}
        aria-controls={`${id}-options`} aria-haspopup="listbox"
        aria-activedescendant={open && activeOption ? `${id}-${activeOption.id}` : undefined}
        placeholder="Search or choose an issue type"
        value={open ? query : selected?.label || ""}
        onFocus={show}
        onClick={() => { if (!open) show(); }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
          onChange("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) { show(); return; }
            setActive((index) => options.length ?
              (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length : 0);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (activeOption) choose(activeOption);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }} />
      <button type="button" className="category-select-toggle" tabIndex={-1}
        aria-label={open ? "Hide issue types" : "Show issue types"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) setOpen(false);
          else { input.current?.focus(); show(); }
        }}><ChevronDown size={17} /></button>
    </div>
    {open && <div id={`${id}-options`} className="category-select-options" role="listbox" aria-label="Issue types"
      onMouseDown={(event) => event.preventDefault()}>
      {groups.map((group) => <div role="group" aria-label={group} key={group}>
        <div className="category-select-group" aria-hidden="true">{group}</div>
        {options.filter((category) => category.group === group).map((category) =>
          <div key={category.id} id={`${id}-${category.id}`} role="option"
            aria-selected={value === category.id}
            className={`category-select-option ${activeOption?.id === category.id ? "active" : ""}`}
            onMouseMove={() => setActive(options.indexOf(category))}
            onClick={() => choose(category)}>{category.label}</div>)}
      </div>)}
      {!options.length && <p className="category-select-empty" role="status">No issue types found. Try a different search.</p>}
    </div>}
  </div>;
}

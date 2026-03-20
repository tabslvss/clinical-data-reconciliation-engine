import { useState, useRef } from "react";

export default function TagInput({ value = [], onChange, placeholder = "Type and press Enter", suggestions = [], error }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  function addTag(raw) {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  }

  function removeTag(i) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function handleKey(e) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && value.length) {
      removeTag(value.length - 1);
    }
  }

  return (
    <div>
      <div
        className={`tag-input-wrap${error ? " error" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, i) => (
          <span key={i} className="tag-pill" style={{ animationDelay: `${i * 30}ms` }}>
            {tag}
            <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(i); }} aria-label={`Remove ${tag}`}>×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="tag-input-inner"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => { if (input.trim()) addTag(input); }}
          placeholder={value.length ? "" : placeholder}
          list={suggestions.length ? "tag-suggestions" : undefined}
        />
        {suggestions.length > 0 && (
          <datalist id="tag-suggestions">
            {suggestions.map(s => <option key={s} value={s} />)}
          </datalist>
        )}
      </div>
      <p className="tag-hint">Press Enter or comma to add each item</p>
    </div>
  );
}

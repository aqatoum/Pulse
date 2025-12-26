// src/pages/surveillance/components/Dropdown.jsx
import React, { useEffect, useRef, useState } from "react";

export default function Dropdown({ value, onChange, options, placeholder, dir = "ltr" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = (options || []).find((o) => o.value === value);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function onKeyDown(e) {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((s) => !s);
    }
  }

  return (
    <div className="dd" ref={rootRef} dir={dir}>
      <button
        type="button"
        className="ddBtn"
        onClick={() => setOpen((s) => !s)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="ddBtnText">{current?.label || placeholder || "—"}</span>
        <span className="ddCaret">▾</span>
      </button>

      {open ? (
        <div className="ddMenu" role="listbox">
          {(options || []).map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                className={`ddItem ${active ? "ddItemActive" : ""}`}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

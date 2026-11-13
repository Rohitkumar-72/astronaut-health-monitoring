import { useEffect, useRef, useState } from "react";
import AssistantChat from "./AssistantChat";

export default function AssistantFloatingButton() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const closeAssistant = () => {
    setOpen(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        closeAssistant();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    panelRef.current?.querySelector("textarea")?.focus();
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className={`assistant-floating-root${open ? " is-open" : ""}`}>
      {open && (
        <section
          ref={panelRef}
          id="astra-floating-assistant"
          className="assistant-floating-window"
          role="dialog"
          aria-modal="false"
          aria-label="ASTRA AI assistant"
        >
          <div className="assistant-floating-window-header">
            <div><span className="app-eyebrow">MISSION MEDICAL SUPPORT</span><strong>ASTRA AI</strong></div>
            <button type="button" className="assistant-floating-close" onClick={closeAssistant} aria-label="Close ASTRA AI">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <AssistantChat compact />
        </section>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="assistant-floating-launcher"
        aria-label={open ? "Close ASTRA AI assistant" : "Open ASTRA AI assistant"}
        aria-expanded={open}
        aria-controls="astra-floating-assistant"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="assistant-launcher-orb" aria-hidden="true"><i /><i /></span>
        <span>{open ? "Close ASTRA" : "Ask ASTRA"}</span>
      </button>
    </div>
  );
}

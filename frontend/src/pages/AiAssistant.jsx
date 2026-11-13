import { useEffect, useState } from "react";
import AssistantChat from "../components/AssistantChat";

export default function AiAssistant() {
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    if (!fullScreen) return undefined;
    const exitOnEscape = (event) => {
      if (event.key === "Escape") setFullScreen(false);
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [fullScreen]);

  return (
    <div className={`app-page ai-assistant-page${fullScreen ? " is-fullscreen" : ""}`}>
      <header className="app-page-header">
        <div>
          <span className="app-eyebrow">MISSION MEDICAL SUPPORT</span>
          <h1>ASTRA AI Assistant</h1>
          <p>Continue your conversation by voice or text. Your conversation stays available as you navigate this session.</p>
        </div>
        <div className="assistant-page-actions">
          <span className="app-demo-tag">GEMINI · SERVER-SIDE</span>
          <button type="button" className="assistant-fullscreen-toggle" aria-pressed={fullScreen} onClick={() => setFullScreen((current) => !current)}>
            {fullScreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </header>

      <AssistantChat />
    </div>
  );
}

export default function Header({ menuButtonRef, isOpen, onToggle }) {
  return (
    <header className="app-topbar">
      <button
        ref={menuButtonRef}
        type="button"
        className="app-menu-toggle"
        aria-label={isOpen ? "Close navigation drawer" : "Open navigation drawer"}
        aria-expanded={isOpen}
        aria-controls="app-navigation-drawer"
        onClick={onToggle}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      <span className="app-topbar-label">ASTRA <span aria-hidden="true">/</span> MISSION CONSOLE</span>
    </header>
  );
}

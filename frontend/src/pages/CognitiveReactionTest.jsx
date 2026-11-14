import { useEffect, useRef, useState } from "react";
import "./CognitiveReactionTest.css";

const TOTAL_ROUNDS = 5;
const RESPONSE_TIMEOUT_MS = 3_000;
const HISTORY_KEY = "astra-cognitive-demo-sessions";

const randomBetween = (minimum, maximum) =>
  minimum + Math.random() * (maximum - minimum);

function readLocalHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function summarizeResults(results) {
  const responses = results
    .filter((result) => result.outcome === "responded")
    .map((result) => result.reactionTime);
  const average = responses.length
    ? Math.round(responses.reduce((total, value) => total + value, 0) / responses.length)
    : null;

  return {
    completedAt: new Date().toISOString(),
    rounds: results.length,
    responses: responses.length,
    earlyClicks: results.filter((result) => result.outcome === "early").length,
    misses: results.filter((result) => result.outcome === "missed").length,
    averageReactionMs: average,
    fastestReactionMs: responses.length ? Math.min(...responses) : null,
    slowestReactionMs: responses.length ? Math.max(...responses) : null,
    accuracy: Math.round((responses.length / TOTAL_ROUNDS) * 100),
    performanceScore: average === null
      ? 0
      : Math.round((responses.length / TOTAL_ROUNDS) * 100 * (600 / (600 + average))),
    source: "Local simulated cognitive test; not a medical record.",
  };
}

export default function CognitiveReactionTest() {
  const [phase, setPhase] = useState("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [stimulus, setStimulus] = useState(null);
  const [results, setResults] = useState([]);
  const [lastOutcome, setLastOutcome] = useState("");
  const [savedSessions, setSavedSessions] = useState(() => readLocalHistory().length);
  const [saveError, setSaveError] = useState("");
  const timerRef = useRef(null);
  const stimulusTimeRef = useRef(null);
  const phaseRef = useRef("intro");
  const resultsRef = useRef([]);

  const setCurrentPhase = (nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const saveResult = (roundResults) => {
    const summary = summarizeResults(roundResults);
    try {
      const history = readLocalHistory();
      const nextHistory = [summary, ...history].slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      setSavedSessions(nextHistory.length);
      setSaveError("");
    } catch {
      setSaveError("This browser could not save the local demonstration session.");
    }
  };

  const beginRound = (index) => {
    clearTimer();
    setRoundIndex(index);
    setStimulus(null);
    setLastOutcome("");
    setCurrentPhase("waiting");

    const delay = randomBetween(1_000, 3_500);
    timerRef.current = window.setTimeout(() => {
      const shownNumber = Math.floor(randomBetween(0, 10));
      stimulusTimeRef.current = performance.now();
      setStimulus(shownNumber);
      setCurrentPhase("stimulus");
      timerRef.current = window.setTimeout(() => {
        completeRound({ outcome: "missed", reactionTime: null, stimulus: shownNumber });
      }, RESPONSE_TIMEOUT_MS);
    }, delay);
  };

  const completeRound = (result) => {
    if (!["waiting", "stimulus"].includes(phaseRef.current)) return;
    clearTimer();
    stimulusTimeRef.current = null;
    const nextResults = [...resultsRef.current, { ...result, round: resultsRef.current.length + 1 }];
    resultsRef.current = nextResults;
    setResults(nextResults);
    setStimulus(null);
    setLastOutcome(result.outcome);

    if (nextResults.length >= TOTAL_ROUNDS) {
      setCurrentPhase("complete");
      saveResult(nextResults);
      return;
    }

    setCurrentPhase("feedback");
    timerRef.current = window.setTimeout(() => beginRound(nextResults.length), 850);
  };

  const startTest = () => {
    clearTimer();
    resultsRef.current = [];
    setResults([]);
    setRoundIndex(0);
    setSaveError("");
    beginRound(0);
  };

  const handleStimulusPress = () => {
    if (phaseRef.current === "waiting") {
      completeRound({ outcome: "early", reactionTime: null, stimulus: null });
      return;
    }
    if (phaseRef.current !== "stimulus" || stimulusTimeRef.current === null) return;
    const reactionTime = Math.max(0, Math.round(performance.now() - stimulusTimeRef.current));
    completeRound({ outcome: "responded", reactionTime, stimulus });
  };

  useEffect(() => () => clearTimer(), []);

  const summary = phase === "complete" ? summarizeResults(results) : null;
  const phaseLabel = {
    waiting: "Ready · wait for the signal",
    stimulus: "Signal shown · respond now",
    feedback: "Response recorded · preparing next round",
  }[phase];

  return (
    <div className="app-page cognitive-test-page">
      <header className="app-page-header">
        <div>
          <span className="app-eyebrow">COGNITIVE PERFORMANCE · DEMO</span>
          <h1 id="cognitive-test-title">Reaction Time Test</h1>
          <p>Five short rounds of responding to a visual signal, with results saved only in this browser.</p>
        </div>
        <span className="app-demo-tag">LOCAL DEMO SESSION</span>
      </header>

      <section className="app-panel cognitive-test-panel" aria-labelledby="cognitive-instructions-title">
        <div className="cognitive-test-intro">
          <div>
            <span className="dashboard-section-kicker">HOW IT WORKS</span>
            <h2 id="cognitive-instructions-title">Wait for a number, then respond</h2>
            <ol>
              <li>Press <strong>Start test</strong> to begin five rounds.</li>
              <li>Wait through the randomized ready period. Pressing early counts as a false start.</li>
              <li>When a number appears, activate the response button as quickly as you can.</li>
              <li>A round with no response within three seconds is recorded as missed.</li>
            </ol>
          </div>
          <p className="cognitive-test-disclaimer">
            This demonstration is not a validated clinical assessment, cannot diagnose impairment, and is not associated with a crew member or medical record.
          </p>
        </div>

        {phase === "intro" && (
          <div className="cognitive-test-start">
            <p>{savedSessions} local demonstration session{savedSessions === 1 ? "" : "s"} saved in this browser.</p>
            <button type="button" className="dashboard-section-link" onClick={startTest}>Start test</button>
          </div>
        )}

        {["waiting", "stimulus", "feedback"].includes(phase) && (
          <div className={`cognitive-test-round cognitive-test-round-${phase}`}>
            <div className="cognitive-test-round-heading">
              <span>ROUND {roundIndex + 1} OF {TOTAL_ROUNDS}</span>
              <strong role="status" aria-live="polite">{phaseLabel}</strong>
            </div>
            <button
              type="button"
              className="cognitive-test-stimulus"
              onClick={handleStimulusPress}
              aria-label={phase === "stimulus" ? `Respond to number ${stimulus}` : "Wait for the number signal"}
              aria-live="assertive"
            >
              {phase === "stimulus" ? stimulus : phase === "waiting" ? "…" : "✓"}
            </button>
            <p className="cognitive-test-feedback" aria-live="polite">
              {phase === "waiting" && "Wait for the number. An early press will be counted as a false start."}
              {phase === "stimulus" && "Press the signal button now."}
              {phase === "feedback" && (lastOutcome === "responded"
                ? `Round ${roundIndex + 1}: ${results.at(-1)?.reactionTime} ms`
                : lastOutcome === "early" ? "False start recorded." : "No response recorded for this round.")}
            </p>
          </div>
        )}

        {summary && (
          <div className="cognitive-test-results" aria-labelledby="cognitive-results-title">
            <span className="dashboard-section-kicker">SESSION COMPLETE</span>
            <h2 id="cognitive-results-title">Your demonstration results</h2>
            <div className="cognitive-test-result-grid">
              <article><span>Average response</span><strong>{summary.averageReactionMs === null ? "—" : `${summary.averageReactionMs} ms`}</strong></article>
              <article><span>Fastest response</span><strong>{summary.fastestReactionMs === null ? "—" : `${summary.fastestReactionMs} ms`}</strong></article>
              <article><span>Slowest response</span><strong>{summary.slowestReactionMs === null ? "—" : `${summary.slowestReactionMs} ms`}</strong></article>
              <article><span>Accuracy</span><strong>{summary.accuracy}%</strong></article>
              <article><span>Performance score</span><strong>{summary.performanceScore} / 100</strong></article>
              <article><span>False starts · missed</span><strong>{summary.earlyClicks} · {summary.misses}</strong></article>
            </div>
            <p className="cognitive-test-result-summary">
              {summary.responses} of {TOTAL_ROUNDS} rounds had valid responses. Results are descriptive for this browser session only.
            </p>
            {saveError && <p role="status" className="cognitive-test-save-error">{saveError}</p>}
            <button type="button" className="dashboard-section-link" onClick={startTest}>Restart test</button>
          </div>
        )}
      </section>
    </div>
  );
}

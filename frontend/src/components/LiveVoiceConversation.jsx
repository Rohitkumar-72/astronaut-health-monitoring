import { useCallback, useEffect, useRef, useState } from "react";
import { createLiveVoiceSession } from "../services/api";

const INPUT_SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;
const SESSION_LIMIT_MESSAGE = "This secure voice session has reached its time limit. Start a new session to continue.";

function resampleToPcm16(samples, sourceRate) {
  const ratio = sourceRate / INPUT_SAMPLE_RATE;
  const outputLength = Math.floor(samples.length / ratio);
  const pcm = new Int16Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    let sample;
    if (ratio >= 1) {
      const start = Math.floor(outputIndex * ratio);
      const end = Math.min(Math.floor((outputIndex + 1) * ratio), samples.length);
      let total = 0;
      for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
        total += samples[inputIndex];
      }
      sample = total / Math.max(1, end - start);
    } else {
      const position = outputIndex * ratio;
      const lower = Math.floor(position);
      const fraction = position - lower;
      const upper = Math.min(lower + 1, samples.length - 1);
      sample = samples[lower] * (1 - fraction) + samples[upper] * fraction;
    }
    sample = Math.max(-1, Math.min(1, sample));
    pcm[outputIndex] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return pcm;
}

function encodeBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}

function decodePcm16(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(Math.floor(bytes.length / 2));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 0x8000;
  }
  return samples;
}

function getHistoryTurns(messages) {
  const history = messages.slice(-20);
  let previousRole = "assistant";
  const validHistory = history.reduce((turns, message) => {
    if (
      !message
      || (message.role !== "user" && message.role !== "assistant")
      || typeof message.content !== "string"
      || !message.content.trim()
      || message.role === previousRole
    ) {
      return turns;
    }

    previousRole = message.role;
    turns.push({
      role: message.role,
      content: message.content.trim().slice(0, 2_000),
    });
    return turns;
  }, []);
  let totalLength = validHistory.reduce((total, message) => total + message.content.length, 0);
  while (totalLength > 12_000 && validHistory.length > 1) {
    totalLength -= validHistory.shift().content.length;
    if (validHistory.length) totalLength -= validHistory.shift().content.length;
  }
  return validHistory;
}

export default function LiveVoiceConversation({
  messages,
  onConversationMessage,
  onStateChange,
  onClose,
  language,
  onLanguageChange,
}) {
  const [status, setStatus] = useState("idle");
  const [muted, setMuted] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const inputSourceRef = useRef(null);
  const inputProcessorRef = useRef(null);
  const silentGainRef = useRef(null);
  const outputSourcesRef = useRef(new Set());
  const playbackTimeRef = useRef(0);
  const requestControllerRef = useRef(null);
  const connectionTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const transcriptFlushTimerRef = useRef(null);
  const sessionHandleRef = useRef("");
  const historyRef = useRef([]);
  const historySentRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const activeRef = useRef(false);
  const readyRef = useRef(false);
  const mountedRef = useRef(false);
  const mutedRef = useRef(false);
  const userTranscriptRef = useRef("");
  const assistantTranscriptRef = useRef("");
  const userTranscriptFinishedRef = useRef(false);
  const assistantTranscriptFinishedRef = useRef(false);
  const turnCompleteRef = useRef(false);
  const audioTurnCompleteRef = useRef(false);

  const updateStatus = useCallback((nextStatus) => {
    if (!mountedRef.current) return;
    setStatus(nextStatus);
    onStateChange?.(nextStatus);
  }, [onStateChange]);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    readyRef.current = false;
    window.clearTimeout(connectionTimerRef.current);
    window.clearTimeout(sessionTimerRef.current);
    window.clearTimeout(reconnectTimerRef.current);
    window.clearTimeout(transcriptFlushTimerRef.current);
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    sessionHandleRef.current = "";

    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "Voice session ended");
      }
    }

    if (inputProcessorRef.current) {
      inputProcessorRef.current.onaudioprocess = null;
      inputProcessorRef.current.disconnect();
      inputProcessorRef.current = null;
    }
    inputSourceRef.current?.disconnect();
    inputSourceRef.current = null;
    silentGainRef.current?.disconnect();
    silentGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    outputSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source can finish between turns and interruption cleanup.
      }
      source.disconnect();
    });
    outputSourcesRef.current.clear();
    playbackTimeRef.current = 0;
    audioTurnCompleteRef.current = false;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
  }, []);

  const failSession = useCallback((message) => {
    cleanup();
    if (mountedRef.current) {
      setError(message);
      setCaption("");
    }
    updateStatus("error");
  }, [cleanup, updateStatus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const flushTranscript = useCallback((role) => {
    const transcriptRef = role === "user" ? userTranscriptRef : assistantTranscriptRef;
    const content = transcriptRef.current.trim();
    transcriptRef.current = "";
    if (content) onConversationMessage({ role, content });
    if (mountedRef.current) setCaption("");
  }, [onConversationMessage]);

  const flushTurn = useCallback(() => {
    window.clearTimeout(transcriptFlushTimerRef.current);
    flushTranscript("user");
    flushTranscript("assistant");
    userTranscriptFinishedRef.current = false;
    assistantTranscriptFinishedRef.current = false;
    turnCompleteRef.current = false;
    audioTurnCompleteRef.current = false;
  }, [flushTranscript]);

  const appendTranscript = useCallback((role, text, finished) => {
    const transcriptRef = role === "user" ? userTranscriptRef : assistantTranscriptRef;
    if (text) transcriptRef.current += text;
    if (mountedRef.current) setCaption(transcriptRef.current.trim() || text || "");
    if (finished) {
      if (role === "user") userTranscriptFinishedRef.current = true;
      else assistantTranscriptFinishedRef.current = true;
      if (
        turnCompleteRef.current
        && userTranscriptFinishedRef.current
        && assistantTranscriptFinishedRef.current
      ) {
        flushTurn();
      }
    }
  }, [flushTurn]);

  const stop = useCallback(() => {
    cleanup();
    userTranscriptRef.current = "";
    assistantTranscriptRef.current = "";
    userTranscriptFinishedRef.current = false;
    assistantTranscriptFinishedRef.current = false;
    turnCompleteRef.current = false;
    audioTurnCompleteRef.current = false;
    if (mountedRef.current) {
      setError("");
      setCaption("");
      setMuted(false);
    }
    mutedRef.current = false;
    updateStatus("idle");
  }, [cleanup, updateStatus]);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    setError("");
    setCaption("");
    userTranscriptRef.current = "";
    assistantTranscriptRef.current = "";
    userTranscriptFinishedRef.current = false;
    assistantTranscriptFinishedRef.current = false;
    turnCompleteRef.current = false;
    sessionHandleRef.current = "";
    historyRef.current = getHistoryTurns(messages);
    historySentRef.current = false;
    reconnectAttemptsRef.current = 0;
    mutedRef.current = false;
    setMuted(false);
    updateStatus("connecting");

    try {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (
        !navigator.mediaDevices?.getUserMedia
        || !AudioContextConstructor
        || !window.WebSocket
      ) {
        throw new Error("Live voice needs a browser with microphone, audio, and WebSocket support. Use text chat or the standard microphone instead.");
      }
      if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        throw new Error("Microphone access requires HTTPS or localhost.");
      }

      const audioContext = new AudioContextConstructor();
      audioContextRef.current = audioContext;
      const audioResume = audioContext.resume().then(
        () => null,
        (error) => error
      );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!activeRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const audioResumeError = await audioResume;
      if (audioResumeError) throw audioResumeError;
      if (!activeRef.current) return;

      const inputSource = audioContext.createMediaStreamSource(stream);
      const inputProcessor = audioContext.createScriptProcessor(2_048, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      inputProcessor.onaudioprocess = (event) => {
        const socket = socketRef.current;
        if (!readyRef.current || mutedRef.current || socket?.readyState !== WebSocket.OPEN) return;

        const input = event.inputBuffer.getChannelData(0);
        const pcm = resampleToPcm16(input, event.inputBuffer.sampleRate);
        if (!pcm.length) return;
        socket.send(JSON.stringify({
          realtimeInput: {
            audio: {
              data: encodeBase64(new Uint8Array(pcm.buffer)),
              mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
            },
          },
        }));
      };
      inputSource.connect(inputProcessor);
      inputProcessor.connect(silentGain);
      silentGain.connect(audioContext.destination);
      inputSourceRef.current = inputSource;
      inputProcessorRef.current = inputProcessor;
      silentGainRef.current = silentGain;

      const requestController = new AbortController();
      requestControllerRef.current = requestController;
      const session = await createLiveVoiceSession(getHistoryTurns(messages), language, {
        signal: requestController.signal,
      });
      if (!activeRef.current) return;
      if (!session?.token || !session?.expiresAt) {
        throw new Error("The backend did not return a usable secure voice session.");
      }

      historyRef.current = getHistoryTurns(messages);
      const connectSocket = (resumeHandle = "") => {
        if (!activeRef.current) return;
        readyRef.current = false;
        updateStatus("connecting");
        let socket;
        try {
          const access = new URLSearchParams({ access_token: session.token });
          socket = new WebSocket(
            `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?${access}`
          );
        } catch {
          failSession("The browser could not open a secure Gemini Live connection.");
          return;
        }
        socketRef.current = socket;
        window.clearTimeout(connectionTimerRef.current);
        connectionTimerRef.current = window.setTimeout(() => {
          if (socketRef.current === socket && !readyRef.current) {
            failSession("Gemini Live did not finish connecting. Check your network and try again.");
          }
        }, 20_000);

        socket.onopen = () => {
          if (!activeRef.current) return;
          socket.send(JSON.stringify({
            setup: {
              model: `models/${session.model}`,
              sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
            },
          }));
        };

        const handleMessage = async (event) => {
          let messageText;
          let message;
          try {
            if (typeof event.data === "string") {
              messageText = event.data;
            } else if (event.data instanceof Blob) {
              messageText = await event.data.text();
            } else if (event.data instanceof ArrayBuffer) {
              messageText = new TextDecoder().decode(event.data);
            } else {
              throw new Error("Unsupported Gemini Live message type.");
            }
            message = JSON.parse(messageText);
          } catch {
            failSession("Gemini Live returned an unreadable response. End the session and try again.");
            return;
          }

          if (message.error) {
            failSession("Gemini Live could not start this voice session. Check the backend configuration and try again.");
            return;
          }

          const resumptionUpdate = message.sessionResumptionUpdate;
          if (resumptionUpdate) {
            sessionHandleRef.current = resumptionUpdate.resumable && resumptionUpdate.newHandle
              ? resumptionUpdate.newHandle
              : "";
          }

          if (message.goAway) {
            if (!sessionHandleRef.current || reconnectAttemptsRef.current >= 2) {
              failSession("Gemini Live is ending this session. Start a new session to continue.");
            }
            return;
          }

          if (message.setupComplete) {
            readyRef.current = true;
            reconnectAttemptsRef.current = 0;
            window.clearTimeout(connectionTimerRef.current);
            if (!historySentRef.current) {
              const history = historyRef.current;
              if (history.length) {
                socket.send(JSON.stringify({
                  clientContent: {
                    turns: history.map(({ role, content }) => ({
                      role: role === "assistant" ? "model" : "user",
                      parts: [{ text: content }],
                    })),
                    turnComplete: false,
                  },
                }));
              }
              historySentRef.current = true;
              const expiresIn = Math.max(0, Date.parse(session.expiresAt) - Date.now());
              sessionTimerRef.current = window.setTimeout(() => {
                failSession(SESSION_LIMIT_MESSAGE);
              }, expiresIn);
            }
            updateStatus("listening");
            return;
          }

          const serverContent = message.serverContent;
          if (!serverContent) return;

          if (serverContent.interimInputTranscription?.text) {
            if (mountedRef.current) setCaption(serverContent.interimInputTranscription.text);
          }
          if (serverContent.inputTranscription) {
            appendTranscript(
              "user",
              serverContent.inputTranscription.text || "",
              Boolean(serverContent.inputTranscription.finished)
            );
            if (serverContent.inputTranscription.finished) updateStatus("processing");
          }
          if (serverContent.outputTranscription) {
            appendTranscript(
              "assistant",
              serverContent.outputTranscription.text || "",
              Boolean(serverContent.outputTranscription.finished)
            );
          }

          if (serverContent.modelTurn?.parts) {
            for (const part of serverContent.modelTurn.parts) {
              if (!part.inlineData?.data) continue;
              const samples = decodePcm16(part.inlineData.data);
              const context = audioContextRef.current;
              if (!context || context.state === "closed" || !samples.length) continue;
              const audioBuffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
              audioBuffer.copyToChannel(samples, 0);
              const source = context.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(context.destination);
              source.onended = () => {
                outputSourcesRef.current.delete(source);
                source.disconnect();
                if (!outputSourcesRef.current.size && audioTurnCompleteRef.current) {
                  audioTurnCompleteRef.current = false;
                  updateStatus("listening");
                }
              };
              const startAt = Math.max(context.currentTime, playbackTimeRef.current);
              source.start(startAt);
              playbackTimeRef.current = startAt + audioBuffer.duration;
              outputSourcesRef.current.add(source);
              updateStatus("speaking");
            }
          }

          if (serverContent.interrupted) {
            outputSourcesRef.current.forEach((source) => {
              try {
                source.stop();
              } catch {
                // The source may have completed before interruption was received.
              }
            });
            outputSourcesRef.current.clear();
            playbackTimeRef.current = 0;
            audioTurnCompleteRef.current = false;
            updateStatus("listening");
          }

          if (serverContent.turnComplete) {
            turnCompleteRef.current = true;
            audioTurnCompleteRef.current = true;
            if (userTranscriptFinishedRef.current && assistantTranscriptFinishedRef.current) {
              flushTurn();
            } else {
              transcriptFlushTimerRef.current = window.setTimeout(flushTurn, 750);
            }
            if (!outputSourcesRef.current.size) {
              audioTurnCompleteRef.current = false;
              updateStatus("listening");
            }
          }
        };
        let incomingMessages = Promise.resolve();
        socket.onmessage = (event) => {
          incomingMessages = incomingMessages.then(() => handleMessage(event)).catch(() => {
            failSession("Gemini Live returned an unreadable response. End the session and try again.");
          });
        };

        socket.onerror = () => {
          if (socketRef.current === socket && !sessionHandleRef.current) {
            failSession("The connection to Gemini Live failed. Check your network and try again.");
          }
        };
        socket.onclose = () => {
          if (activeRef.current && socketRef.current === socket) {
            if (sessionHandleRef.current && reconnectAttemptsRef.current < 2) {
              reconnectAttemptsRef.current += 1;
              reconnectTimerRef.current = window.setTimeout(
                () => connectSocket(sessionHandleRef.current),
                500
              );
            } else {
              failSession("The Gemini Live voice session ended unexpectedly. Start a new session to continue.");
            }
          }
        };
      };

      connectSocket();
    } catch (sessionError) {
      if (!activeRef.current || sessionError.name === "AbortError") return;
      const message = {
        NotAllowedError: "Microphone permission was denied. Allow microphone access and retry.",
        PermissionDeniedError: "Microphone permission was denied. Allow microphone access and retry.",
        NotFoundError: "No microphone was found. Connect a microphone and retry.",
        DevicesNotFoundError: "No microphone was found. Connect a microphone and retry.",
        NotReadableError: "The microphone is unavailable or being used by another app.",
        TrackStartError: "The microphone is unavailable or being used by another app.",
      }[sessionError.name] || sessionError.message || "The voice session could not be started.";
      failSession(message);
    }
  }, [
    appendTranscript,
    failSession,
    flushTurn,
    language,
    messages,
    updateStatus,
  ]);

  const toggleMute = () => {
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  };

  const statusText = {
    idle: "Voice is off",
    connecting: "Connecting to ASTRA. Allow microphone access when prompted…",
    listening: muted ? "Microphone muted. Unmute or end the session." : "Listening… Speak to ASTRA; you can interrupt while ASTRA speaks.",
    processing: "ASTRA is thinking…",
    speaking: "ASTRA is speaking. You can interrupt by speaking.",
    error: "Voice connection failed. Please retry.",
  }[status];

  return (
    <div className={`assistant-live-voice assistant-live-voice-${status}`} aria-label="ASTRA live voice conversation">
      <div className="assistant-live-voice-indicator" aria-hidden="true">
        <span /><span /><span /><span /><span />
      </div>
      <div className="assistant-live-voice-copy">
        <strong>{statusText}</strong>
        <span aria-live="polite">
          {caption || (error
            ? "Microphone is off until you retry."
            : "No background recording. Audio streams to Gemini only while this session is active; sessions expire after 30 minutes.")}
        </span>
        {error && <span className="assistant-live-voice-error" role="alert">{error}</span>}
      </div>
      <div className="assistant-live-voice-controls">
        {status === "idle" && (
          <label className="assistant-live-language-select">
            <span>Conversation language</span>
            <select value={language} onChange={(event) => onLanguageChange(event.target.value)} aria-label="Live conversation language">
              <option value="auto">Auto-detect</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Hinglish">Hinglish</option>
            </select>
          </label>
        )}
        {(status === "idle" || status === "error") && (
          <button type="button" className="assistant-live-start-button" onClick={start}>
            {status === "error" ? "Try again" : "Start live voice"}
          </button>
        )}
        {status !== "idle" && status !== "error" && (
          <>
            <button
              type="button"
              onClick={toggleMute}
              disabled={status === "connecting"}
              aria-pressed={muted}
            >
              {muted ? "Unmute mic" : "Mute mic"}
            </button>
            <button type="button" onClick={stop}>End voice</button>
          </>
        )}
        <button type="button" className="assistant-live-close-button" onClick={onClose} aria-label="Close live voice controls">
          Close
        </button>
      </div>
    </div>
  );
}

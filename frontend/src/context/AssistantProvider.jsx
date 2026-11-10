import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendAssistantMessage } from "../services/api";
import { AssistantContext } from "./assistantContext";

const MAX_CONTEXT_CHARACTERS = 12_000;

function getRequestConversation(conversation) {
  const recentMessages = conversation.slice(-19);
  let totalLength = recentMessages.reduce((total, message) => total + message.content.length, 0);

  while (totalLength > MAX_CONTEXT_CHARACTERS && recentMessages.length > 1) {
    const removedMessages = recentMessages.splice(0, 2);
    totalLength -= removedMessages.reduce((total, message) => total + message.content.length, 0);
  }

  return recentMessages;
}

function useBrowserSpeech() {
  const supported = typeof window !== "undefined"
    && Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [status, setStatus] = useState("idle");
  const [activeText, setActiveText] = useState("");
  const utteranceRef = useRef(null);
  const activeTextRef = useRef("");
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    if (!supported) return () => { mountedRef.current = false; };

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      setSelectedVoiceURI((current) => current || availableVoices.find((voice) => voice.default)?.voiceURI || availableVoices[0]?.voiceURI || "");
    };

    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      mountedRef.current = false;
      window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    activeTextRef.current = "";
    setActiveText("");
    setStatus("idle");
  }, [supported]);

  const speak = useCallback((text) => {
    if (!supported || !text?.trim()) return false;
    const normalizedText = text.trim();
    if (activeTextRef.current === normalizedText && window.speechSynthesis.speaking) return true;

    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(normalizedText);
    const voice = voices.find((candidate) => candidate.voiceURI === selectedVoiceURI);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onstart = () => {
      if (mountedRef.current && utteranceRef.current === utterance) setStatus("speaking");
    };
    utterance.onpause = () => {
      if (mountedRef.current && utteranceRef.current === utterance) setStatus("paused");
    };
    utterance.onresume = () => {
      if (mountedRef.current && utteranceRef.current === utterance) setStatus("speaking");
    };
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      activeTextRef.current = "";
      setActiveText("");
      if (mountedRef.current) setStatus("idle");
    };
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      activeTextRef.current = "";
      setActiveText("");
      if (mountedRef.current) setStatus("error");
    };

    utteranceRef.current = utterance;
    activeTextRef.current = normalizedText;
    setActiveText(normalizedText);
    setStatus("speaking");
    window.speechSynthesis.speak(utterance);
    return true;
  }, [selectedVoiceURI, supported, voices]);

  const pause = useCallback(() => {
    if (!supported || typeof window.speechSynthesis.pause !== "function"
      || !window.speechSynthesis.speaking || window.speechSynthesis.paused) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported || typeof window.speechSynthesis.resume !== "function" || !window.speechSynthesis.paused) return;
    window.speechSynthesis.resume();
    setStatus("speaking");
  }, [supported]);

  return {
    supported,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    status,
    activeText,
    canPause: supported
      && typeof window.speechSynthesis?.pause === "function"
      && typeof window.speechSynthesis?.resume === "function",
    speak,
    stop,
    pause,
    resume,
  };
}

export function AssistantProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(false);
  const pendingRef = useRef(false);
  const requestRef = useRef(null);
  const speech = useBrowserSpeech();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  const requestReply = useCallback(async (conversation) => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const response = await sendAssistantMessage(getRequestConversation(conversation), { signal: controller.signal });
      if (!mountedRef.current) return false;
      setMessages([...conversation, { role: "assistant", content: response.reply }]);
      return true;
    } catch (requestError) {
      if (!mountedRef.current || requestError.name === "AbortError") return false;
      const errorMessage = requestError.message || "The assistant could not respond. Try again.";
      setError(requestError.code ? `${errorMessage} (${requestError.code})` : errorMessage);
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        pendingRef.current = false;
        if (mountedRef.current) setPending(false);
      }
    }
  }, []);

  const sendMessage = useCallback(async (content) => {
    const text = content.trim();
    if (!text || pendingRef.current || error) return false;
    speech.stop();
    const conversation = [...messages, { role: "user", content: text }];
    setMessages(conversation);
    return requestReply(conversation);
  }, [error, messages, requestReply, speech]);

  const retryLastMessage = useCallback(() => {
    if (!messages.length || messages.at(-1)?.role !== "user") return false;
    return requestReply(messages);
  }, [messages, requestReply]);

  const editLastMessage = useCallback(() => {
    if (!messages.length || messages.at(-1)?.role !== "user" || pendingRef.current) return "";
    const text = messages.at(-1).content;
    setMessages((currentMessages) => currentMessages.slice(0, -1));
    setError("");
    return text;
  }, [messages]);

  const clearConversation = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    pendingRef.current = false;
    setPending(false);
    setMessages([]);
    setError("");
    speech.stop();
  }, [speech]);

  const value = useMemo(() => ({
    messages,
    pending,
    error,
    sendMessage,
    retryLastMessage,
    editLastMessage,
    clearConversation,
    speech,
  }), [clearConversation, editLastMessage, error, messages, pending, retryLastMessage, sendMessage, speech]);

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

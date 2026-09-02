import { useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function setComposerValue(value: string) {
  const input = document.querySelector<HTMLTextAreaElement>('.ws-ai-input');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  return true;
}

function openAssistant() {
  const launcher = document.querySelector<HTMLButtonElement>('.ws-ai-launcher');
  if (launcher && launcher.getAttribute('aria-label')?.startsWith('Open')) launcher.click();
}

export function WorkSocialAiVoiceBridge() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const RecognitionRef = useRef<SpeechRecognitionConstructor | null>(null);
  const speakingRef = useRef(false);
  const voiceRepliesRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [available, setAvailable] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setAvailable(false);
      return;
    }
    RecognitionRef.current = Recognition;

    return () => {
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
      RecognitionRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const startRecognition = () => {
    const Recognition = RecognitionRef.current;
    if (!Recognition) return false;

    try { recognitionRef.current?.stop(); } catch { /* reset stale instance */ }

    const recognition = new Recognition();
    recognition.lang = 'ur-PK';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setListening(false);
      }
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setListening(false);
      }
      setNotice(event.error === 'not-allowed' ? 'Microphone permission is required.' : 'Voice input could not be heard. Please try again.');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();
      if (!transcript) return;
      openAssistant();
      window.setTimeout(() => {
        if (!setComposerValue(transcript)) setNotice('Open Work Social AI first, then tap the microphone again.');
      }, 120);
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  };

  useEffect(() => {
    voiceRepliesRef.current = voiceReplies;
  }, [voiceReplies]);

  useEffect(() => {
    if (!voiceReplies) return;
    const root = document.querySelector('.ws-ai-messages');
    if (!root) return;
    let lastAssistantText = '';

    const speakLatest = () => {
      if (!voiceRepliesRef.current || speakingRef.current) return;
      const nodes = root.querySelectorAll<HTMLElement>('.ws-ai-bubble.assistant');
      const latest = nodes[nodes.length - 1]?.innerText?.trim() ?? '';
      if (!latest || latest === lastAssistantText) return;
      lastAssistantText = latest;
      window.speechSynthesis?.cancel();
      const utterance = new SpeechSynthesisUtterance(latest);
      utterance.lang = /[\u0600-\u06ff]/.test(latest) ? 'ur-PK' : 'en-US';
      utterance.onstart = () => { speakingRef.current = true; };
      utterance.onend = () => { speakingRef.current = false; };
      utterance.onerror = () => { speakingRef.current = false; };
      window.speechSynthesis?.speak(utterance);
    };
    const observer = new MutationObserver(speakLatest);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [voiceReplies]);

  if (!available) return null;

  const toggleListening = () => {
    setNotice(null);
    if (listening) {
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      return;
    }
    try {
      startRecognition();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setNotice('Voice input could not start. Please try again.');
    }
  };

  return (
    <>
      <div className="ws-ai-voice-controls" aria-label="Work Social AI voice controls">
        <button type="button" className={`ws-ai-voice-button${listening ? ' listening' : ''}`} onClick={toggleListening} aria-label={listening ? 'Stop voice input' : 'Speak to Work Social AI'} title={listening ? 'Stop listening' : 'Speak to Work Social AI'}>
          {listening ? '■' : '🎙️'}
        </button>
      </div>
      {notice ? <div className="ws-ai-voice-notice" role="status">{notice}</div> : null}
      <style>{`
        .ws-ai-voice-controls{display:contents}
        .ws-ai-voice-button{width:44px;height:42px;min-width:44px;flex:0 0 44px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.07);color:#fff;cursor:pointer;font-size:17px;display:grid;place-items:center}
        .ws-ai-voice-button:hover{background:rgba(59,130,246,.2);border-color:rgba(96,165,250,.35)}
        .ws-ai-voice-button.listening{background:rgba(220,38,38,.2);border-color:rgba(248,113,113,.45);animation:ws-ai-voice-pulse 1.2s infinite}
        .ws-ai-voice-notice{position:fixed;right:18px;bottom:145px;z-index:1502;max-width:min(360px,calc(100vw - 36px));padding:9px 12px;border:1px solid rgba(248,113,113,.25);border-radius:11px;background:rgba(45,16,25,.94);color:#fecaca;font-size:11px;box-shadow:0 12px 28px rgba(0,0,0,.25)}
        @keyframes ws-ai-voice-pulse{50%{transform:scale(.94);opacity:.72}}
        @media(max-width:680px){.ws-ai-voice-button{width:42px;min-width:42px;flex-basis:42px}.ws-ai-voice-notice{bottom:132px}}
      `}</style>
    </>
  );
}

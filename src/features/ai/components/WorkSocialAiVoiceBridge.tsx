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
  const speakingRef = useRef(false);
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

    const recognition = new Recognition();
    recognition.lang = 'ur-PK';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (event) => {
      setListening(false);
      recognitionRef.current = null;
      setNotice(event.error === 'not-allowed' ? 'Microphone permission is required.' : 'Voice input could not be heard. Please try again.');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(' ').trim();
      if (!transcript) return;
      openAssistant();
      window.setTimeout(() => {
        if (!setComposerValue(transcript)) setNotice('Open Work Social AI first, then tap the microphone again.');
        else window.setTimeout(() => document.querySelector<HTMLButtonElement>('.ws-ai-send')?.click(), 80);
      }, 180);
    };
    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      try { recognition.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!voiceReplies) return;
    const root = document.querySelector('.ws-ai-messages');
    if (!root) return;
    let lastAssistantText = '';
    const speakLatest = () => {
      if (speakingRef.current) return;
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
      recognitionRef.current?.stop();
      return;
    }
    try {
      recognitionRef.current?.start();
    } catch {
      setNotice('Voice input is already starting.');
    }
  };

  return (
    <>
      <div className="ws-ai-voice-controls" aria-label="Work Social AI voice controls">
        <button type="button" className={`ws-ai-voice-button${listening ? ' listening' : ''}`} onClick={toggleListening} aria-label={listening ? 'Stop voice input' : 'Speak to Work Social AI'} title={listening ? 'Stop listening' : 'Speak to Work Social AI'}>
          {listening ? '■' : '🎙️'}
        </button>
        <button type="button" className={`ws-ai-voice-speaker${voiceReplies ? ' active' : ''}`} onClick={() => setVoiceReplies((value) => !value)} aria-label={voiceReplies ? 'Turn off AI voice replies' : 'Turn on AI voice replies'} title={voiceReplies ? 'Voice replies on' : 'Voice replies off'}>
          {voiceReplies ? '🔊' : '🔈'}
        </button>
      </div>
      {notice ? <div className="ws-ai-voice-notice" role="status">{notice}</div> : null}
      <style>{`\n        .ws-ai-voice-controls{position:fixed;right:86px;bottom:82px;z-index:1501;display:flex;gap:7px;padding:6px;border:1px solid rgba(255,255,255,.16);border-radius:17px;background:rgba(8,14,28,.92);box-shadow:0 12px 30px rgba(2,6,23,.32);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}\n        .ws-ai-voice-button,.ws-ai-voice-speaker{width:42px;height:42px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.07);color:#fff;cursor:pointer;font-size:17px;display:grid;place-items:center}\n        .ws-ai-voice-button:hover,.ws-ai-voice-speaker:hover,.ws-ai-voice-speaker.active{background:rgba(59,130,246,.2);border-color:rgba(96,165,250,.35)}\n        .ws-ai-voice-button.listening{background:rgba(220,38,38,.2);border-color:rgba(248,113,113,.45);animation:ws-ai-voice-pulse 1.2s infinite}\n        .ws-ai-voice-notice{position:fixed;right:18px;bottom:145px;z-index:1502;max-width:min(360px,calc(100vw - 36px));padding:9px 12px;border:1px solid rgba(248,113,113,.25);border-radius:11px;background:rgba(45,16,25,.94);color:#fecaca;font-size:11px;box-shadow:0 12px 28px rgba(0,0,0,.25)}\n        @keyframes ws-ai-voice-pulse{50%{transform:scale(.94);opacity:.72}}\n        @media(max-width:680px){.ws-ai-voice-controls{right:78px;bottom:78px}.ws-ai-voice-button,.ws-ai-voice-speaker{width:40px;height:40px}.ws-ai-voice-notice{bottom:132px}}\n      `}</style>
    </>
  );
}

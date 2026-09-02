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

function speak(text: string, onPlaying?: (value: boolean) => void) {
  if (!('speechSynthesis' in window) || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = /[\u0600-\u06ff]/.test(text) ? 'ur-PK' : 'en-US';
  utterance.onstart = () => onPlaying?.(true);
  utterance.onend = () => onPlaying?.(false);
  utterance.onerror = () => onPlaying?.(false);
  window.speechSynthesis.speak(utterance);
}

export function WorkSocialAiVoiceBridge() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const RecognitionRef = useRef<SpeechRecognitionConstructor | null>(null);
  const [listening, setListening] = useState(false);
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
    if (!Recognition) return;
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
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setNotice('Voice input could not start. Please try again.');
    }
  };

  useEffect(() => {
    if (!available) return;
    const mountControls = () => {
      const composer = document.querySelector<HTMLElement>('.ws-ai-composer');
      if (composer && !composer.querySelector('.ws-ai-inline-mic')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ws-ai-inline-mic';
        button.setAttribute('aria-label', 'Speak to Work Social AI');
        button.title = 'Speak to Work Social AI';
        button.textContent = '🎙️';
        button.addEventListener('click', () => {
          setNotice(null);
          if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { /* already stopped */ }
          } else {
            startRecognition();
          }
        });
        const send = composer.querySelector('.ws-ai-send');
        if (send) composer.insertBefore(button, send);
        else composer.appendChild(button);
      }

      document.querySelectorAll<HTMLElement>('.ws-ai-bubble.assistant').forEach((bubble) => {
        if (bubble.querySelector('.ws-ai-inline-speaker')) return;
        const speaker = document.createElement('button');
        speaker.type = 'button';
        speaker.className = 'ws-ai-inline-speaker';
        speaker.setAttribute('aria-label', 'Read this AI reply aloud');
        speaker.title = 'Read this reply aloud';
        speaker.textContent = '🔊';
        speaker.addEventListener('click', () => {
          const text = Array.from(bubble.childNodes)
            .filter((node) => node !== speaker)
            .map((node) => node.textContent ?? '')
            .join(' ')
            .trim();
          speak(text, (playing) => {
            speaker.textContent = playing ? '■' : '🔊';
            speaker.classList.toggle('playing', playing);
          });
        });
        bubble.appendChild(speaker);
      });
    };

    mountControls();
    const observer = new MutationObserver(mountControls);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(mountControls, 500);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      document.querySelectorAll('.ws-ai-inline-mic,.ws-ai-inline-speaker').forEach((node) => node.remove());
    };
  }, [available]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!available) return null;

  return (
    <>
      {notice ? <div className="ws-ai-voice-notice" role="status">{notice}</div> : null}
      <style>{`
        .ws-ai-inline-mic{width:44px;height:42px;min-width:44px;flex:0 0 44px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.07);color:#fff;cursor:pointer;font-size:17px;display:grid;place-items:center}
        .ws-ai-inline-mic:hover{background:rgba(59,130,246,.2);border-color:rgba(96,165,250,.35)}
        .ws-ai-inline-speaker{display:inline-grid;place-items:center;margin-top:8px;width:30px;height:30px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.055);color:#cbd5e1;cursor:pointer;font-size:14px;vertical-align:middle}
        .ws-ai-inline-speaker:hover,.ws-ai-inline-speaker.playing{background:rgba(59,130,246,.2);border-color:rgba(96,165,250,.4);color:#fff}
        .ws-ai-voice-notice{position:fixed;right:18px;bottom:145px;z-index:1502;max-width:min(360px,calc(100vw - 36px));padding:9px 12px;border:1px solid rgba(248,113,113,.25);border-radius:11px;background:rgba(45,16,25,.94);color:#fecaca;font-size:11px;box-shadow:0 12px 28px rgba(0,0,0,.25)}
        @media(max-width:680px){.ws-ai-inline-mic{width:42px;min-width:42px;flex-basis:42px}.ws-ai-inline-speaker{width:30px;height:30px}.ws-ai-voice-notice{bottom:132px}}
      `}</style>
    </>
  );
}

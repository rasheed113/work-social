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

declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor } }

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

function speak(text: string, done?: () => void) {
  if (!('speechSynthesis' in window) || !text.trim()) { done?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = /[\u0600-\u06ff]/.test(text) ? 'ur-PK' : 'en-US';
  utterance.onend = () => done?.();
  utterance.onerror = () => done?.();
  window.speechSynthesis.speak(utterance);
}

export function WorkSocialAiVoiceBridge() {
  const RecognitionRef = useRef<SpeechRecognitionConstructor | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceModeRef = useRef(false);
  const sendTimerRef = useRef<number | null>(null);
  const lastAssistantRef = useRef('');
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [available, setAvailable] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setAvailable(false); return; }
    RecognitionRef.current = Recognition;
    return () => {
      voiceModeRef.current = false;
      if (sendTimerRef.current !== null) window.clearTimeout(sendTimerRef.current);
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
      RecognitionRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const startListening = () => {
    const Recognition = RecognitionRef.current;
    if (!Recognition || !voiceModeRef.current || recognitionRef.current) return;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'ur-PK';
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = '';
    let autoSendTimer: number | null = null;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += `${text} `;
        else interim += text;
      }
      const visible = `${finalText}${interim}`.trim();
      if (visible) setComposerValue(visible);
      if (finalText.trim()) {
        if (autoSendTimer !== null) window.clearTimeout(autoSendTimer);
        autoSendTimer = window.setTimeout(() => {
          if (!voiceModeRef.current || !finalText.trim()) return;
          const send = document.querySelector<HTMLButtonElement>('.ws-ai-send');
          if (!send) return;
          try { recognition.stop(); } catch { /* already ended */ }
          recognitionRef.current = null;
          setListening(false);
          send.click();
          finalText = '';
        }, 850);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        voiceModeRef.current = false;
        setVoiceMode(false);
        setListening(false);
        recognitionRef.current = null;
        setNotice('Microphone permission is required.');
      }
    };
    recognition.onend = () => {
      if (autoSendTimer !== null) window.clearTimeout(autoSendTimer);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
      if (voiceModeRef.current) window.setTimeout(startListening, 180);
    };
    try { recognition.start(); }
    catch {
      recognitionRef.current = null;
      setListening(false);
      if (voiceModeRef.current) window.setTimeout(startListening, 300);
    }
  };

  const stopVoiceMode = () => {
    voiceModeRef.current = false;
    setVoiceMode(false);
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;
    setListening(false);
    window.speechSynthesis?.cancel();
  };

  const startVoiceMode = () => {
    setNotice(null);
    openAssistant();
    voiceModeRef.current = true;
    setVoiceMode(true);
    window.setTimeout(startListening, 150);
  };

  useEffect(() => {
    if (!available) return;
    const mount = () => {
      const composer = document.querySelector<HTMLElement>('.ws-ai-composer');
      if (composer && !composer.querySelector('.ws-ai-inline-voice')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ws-ai-inline-voice';
        button.title = 'Voice chat';
        button.setAttribute('aria-label', 'Start voice chat');
        button.textContent = '🎙️';
        button.addEventListener('click', () => voiceModeRef.current ? stopVoiceMode() : startVoiceMode());
        const send = composer.querySelector('.ws-ai-send');
        if (send) composer.insertBefore(button, send);
        else composer.appendChild(button);
      }
      const root = document.querySelector('.ws-ai-messages');
      if (!root) return;
      const bubbles = root.querySelectorAll<HTMLElement>('.ws-ai-bubble.assistant');
      const latest = bubbles[bubbles.length - 1];
      if (latest && !latest.querySelector('.ws-ai-inline-speaker')) {
        const speaker = document.createElement('button');
        speaker.type = 'button';
        speaker.className = 'ws-ai-inline-speaker';
        speaker.textContent = '🔊';
        speaker.title = 'Read reply aloud';
        speaker.setAttribute('aria-label', 'Read AI reply aloud');
        speaker.addEventListener('click', () => {
          const text = Array.from(latest.childNodes).filter((n) => n !== speaker).map((n) => n.textContent ?? '').join(' ').trim();
          speak(text, () => { speaker.textContent = '🔊'; });
          speaker.textContent = '■';
        });
        latest.appendChild(speaker);
      }
      if (voiceModeRef.current && latest) {
        const text = Array.from(latest.childNodes).filter((n) => !(n as HTMLElement).classList?.contains?.('ws-ai-inline-speaker')).map((n) => n.textContent ?? '').join(' ').trim();
        if (text && text !== lastAssistantRef.current) {
          lastAssistantRef.current = text;
          try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
          recognitionRef.current = null;
          setListening(false);
          speak(text, () => { if (voiceModeRef.current) window.setTimeout(startListening, 250); });
        }
      }
    };
    mount();
    const observer = new MutationObserver(mount);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [available]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!available) return null;
  return <>
    {notice ? <div className="ws-ai-voice-notice" role="status">{notice}</div> : null}
    <style>{`
      .ws-ai-inline-voice{width:44px;height:42px;min-width:44px;flex:0 0 44px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.07);color:#fff;cursor:pointer;font-size:17px;display:grid;place-items:center}
      .ws-ai-inline-voice:hover{background:rgba(59,130,246,.2);border-color:rgba(96,165,250,.35)}
      .ws-ai-inline-speaker{display:inline-grid;place-items:center;margin-top:8px;width:30px;height:30px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.055);color:#cbd5e1;cursor:pointer;font-size:14px;vertical-align:middle}
      .ws-ai-inline-speaker:hover{background:rgba(59,130,246,.2);border-color:rgba(96,165,250,.4);color:#fff}
      .ws-ai-voice-notice{position:fixed;right:18px;bottom:145px;z-index:1502;max-width:min(360px,calc(100vw - 36px));padding:9px 12px;border:1px solid rgba(248,113,113,.25);border-radius:11px;background:rgba(45,16,25,.94);color:#fecaca;font-size:11px;box-shadow:0 12px 28px rgba(0,0,0,.25)}
      @media(max-width:680px){.ws-ai-inline-voice{width:42px;min-width:42px;flex-basis:42px}.ws-ai-voice-notice{bottom:132px}}
    `}</style>
  </>;
}

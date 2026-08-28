import { useEffect, useRef, useState } from 'react';

/** Enhances the existing call surface without replacing the WebRTC controller. */
export function CallSpeakerEnhancer() {
  const [visible, setVisible] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    // Call controls are portaled into the chat header. If that header is ever
    // inside a form, the browser's default button behavior can submit/navigate
    // immediately after the click and unmount the WebRTC controller. Make every
    // call control an explicit non-submit control and stop that default action.
    const protectCallButtons = (root: ParentNode = document) => {
      const buttons = root.querySelectorAll?.('button[aria-label="Start voice call"], button[aria-label="Start video call"], .inbox-call-actions button, .inbox-incoming-actions button') ?? [];
      buttons.forEach(button => {
        (button as HTMLButtonElement).type = 'button';
      });
    };

    const preventCallSubmit = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest('button[aria-label="Start voice call"], button[aria-label="Start video call"], .inbox-call-actions button, .inbox-incoming-actions button');
      if (button) event.preventDefault();
    };

    protectCallButtons();
    document.addEventListener('click', preventCallSubmit, true);

    const apply = async () => {
      protectCallButtons();
      const stage = document.querySelector('.inbox-call-stage');
      const actions = document.querySelector('.inbox-call-actions');
      if (!stage || !actions) {
        if (mounted.current) setVisible(false);
        return;
      }
      if (actions.querySelector('[data-call-speaker]')) {
        setVisible(true);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.callSpeaker = 'true';
      button.title = 'Speaker';
      button.setAttribute('aria-label', 'Toggle speaker');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
      const update = (on: boolean) => {
        button.dataset.active = String(on);
        button.style.background = on ? 'linear-gradient(145deg,#2563eb,#7c3aed)' : 'rgba(255,255,255,.12)';
        button.style.boxShadow = on ? '0 8px 24px rgba(59,130,246,.35)' : 'none';
        button.setAttribute('aria-pressed', String(on));
      };
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const media = Array.from(stage.querySelectorAll('audio,video')) as HTMLMediaElement[];
        const next = !button.dataset.active || button.dataset.active !== 'true';
        let changed = false;
        for (const element of media) {
          const candidate = element as HTMLMediaElement & { setSinkId?: (sinkId: string) => Promise<void> };
          if (typeof candidate.setSinkId === 'function') {
            try {
              await candidate.setSinkId('default');
              changed = true;
            } catch {
              // Browser does not expose output-device selection; normal playback remains active.
            }
          }
        }
        update(next);
        if (!changed && next) {
          button.title = 'Speaker output is controlled by the browser/device';
        } else {
          button.title = next ? 'Speaker on' : 'Speaker off';
        }
        setSpeaker(next);
      });
      update(false);
      actions.insertBefore(button, actions.firstChild);
      setVisible(true);
    };

    const observer = new MutationObserver(() => void apply());
    observer.observe(document.body, { childList: true, subtree: true });
    void apply();
    return () => {
      mounted.current = false;
      observer.disconnect();
      document.removeEventListener('click', preventCallSubmit, true);
      document.querySelector('[data-call-speaker]')?.remove();
    };
  }, []);

  if (!visible) return null;
  return <style>{`.inbox-call-actions [data-call-speaker]{transition:transform .18s ease,box-shadow .18s ease,background .18s ease}.inbox-call-actions [data-call-speaker]:hover{transform:translateY(-2px)}.inbox-call-actions [data-call-speaker] svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}`}</style>;
}

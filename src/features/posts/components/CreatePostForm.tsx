import { useEffect, useRef, useState } from 'react';
import { createPost, type PostAttachmentInput, type PostLocationInput } from '../api/createPost';

interface CreatePostFormProps { profileId: string; onCreated: () => void; }
type SelectedFile = PostAttachmentInput & { preview: string };

export function CreatePostForm({ profileId, onCreated }: CreatePostFormProps) {
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [location, setLocation] = useState<PostLocationInput | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => selectedFiles.forEach((item) => URL.revokeObjectURL(item.preview)), [selectedFiles]);

  function chooseMedia() { mediaInputRef.current?.click(); }
  function chooseFile() { fileInputRef.current?.click(); }
  function addFiles(event: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'video' | 'file') {
    const next = Array.from(event.target.files ?? []).map((file) => ({ file, kind, preview: URL.createObjectURL(file) }));
    setSelectedFiles((current) => [...current, ...next]); event.target.value = '';
  }
  function onMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? []).map((file) => ({ file, kind: file.type.startsWith('video/') ? 'video' as const : 'image' as const, preview: URL.createObjectURL(file) }));
    setSelectedFiles((current) => [...current, ...next]); event.target.value = '';
  }
  function getLocation() {
    if (!navigator.geolocation) return setError('Location is not supported by this browser.');
    setLocationLoading(true); setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => { setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocationLoading(false); },
      (geoError) => { setError(geoError.message || 'Unable to get your location.'); setLocationLoading(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
  async function submit() {
    setSaving(true); setError(null);
    const { error: createError } = await createPost(profileId, content, selectedFiles.map(({ file, kind }) => ({ file, kind })), location);
    if (createError) { setError(createError.message); setSaving(false); return; }
    selectedFiles.forEach((item) => URL.revokeObjectURL(item.preview));
    setSelectedFiles([]); setLocation(null); setContent(''); setSaving(false); onCreated();
  }
  const canPost = Boolean(content.trim() || selectedFiles.length || location);

  return <section className="home-create-post" style={{ position: 'relative', overflow: 'hidden', padding: 10 }}>
    <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
      <div style={{ minWidth: 0 }}>
        <h2 className="ws-heading ws-cyan-text" style={{ margin: 0, fontSize: 15, lineHeight: 1.1 }}>Create post</h2>
        <small className="ws-muted-text" style={{ display: 'block', marginTop: 2, fontSize: 10.5, lineHeight: 1.2 }}>Share something with your community</small>
      </div>
      <span aria-hidden="true" style={{ width: 27, height: 27, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 9, color: 'var(--ws-cyan)', fontSize: 13 }}>✦</span>
    </header>
    <textarea
      value={content}
      onChange={(event) => setContent(event.target.value)}
      placeholder="What's happening?"
      disabled={saving}
      style={{ width: '100%', minHeight: 46, height: 50, boxSizing: 'border-box', resize: 'vertical', padding: '7px 9px', outline: 'none', color: 'var(--ws-text-primary)', fontSize: 13, lineHeight: 1.3 }}
    />
    <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={onMedia} />
    <input ref={fileInputRef} type="file" hidden onChange={(event) => addFiles(event, 'file')} />
    <div className="create-post-attachment-actions" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', margin: '6px 0 0' }}>
      <button type="button" className="ws-glass ws-glow-cyan create-post-attachment-btn create-post-attachment-media" onClick={chooseMedia} disabled={saving}>📷 Photo / Video</button>
      <button type="button" className="ws-glass ws-glow-cyan create-post-attachment-btn create-post-attachment-file" onClick={chooseFile} disabled={saving}>📎 File</button>
      <button type="button" className="ws-glass ws-glow-cyan create-post-attachment-btn create-post-attachment-location" onClick={getLocation} disabled={saving || locationLoading}>📍 {locationLoading ? 'Getting location…' : 'Location'}</button>
      <button type="button" className="ws-glass ws-glow-cyan" onClick={() => void submit()} disabled={saving || !canPost} style={{ marginLeft: 'auto' }}>{saving ? 'Posting…' : 'Post'}</button>
    </div>
    {selectedFiles.length > 0 && <div style={{ display: 'grid', gap: 6, marginTop: 7, marginBottom: 7 }}>
      {selectedFiles.map((item, index) => <div key={`${item.file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, padding: 6 }}>
        {item.kind === 'image' ? <img src={item.preview} alt={item.file.name} width={64} height={64} style={{ objectFit: 'cover', borderRadius: 9, flexShrink: 0 }} /> : item.kind === 'video' ? <video src={item.preview} width={110} height={64} controls style={{ maxWidth: '100%', borderRadius: 9, flexShrink: 0 }} /> : <span className="ws-muted-text" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>📎 {item.file.name}</span>}
        <button type="button" className="ws-glass ws-glow-cyan" onClick={() => setSelectedFiles((current) => current.filter((_, i) => i !== index))} disabled={saving} style={{ marginLeft: 'auto', flexShrink: 0 }}>Remove</button>
      </div>)}
    </div>}
    {location && <p style={{ margin: '6px 0 0', padding: '7px 9px', fontSize: 11, fontWeight: 700 }}>📍 Location attached ({location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}) <button type="button" className="ws-glass ws-glow-cyan" onClick={() => setLocation(null)} disabled={saving} style={{ marginLeft: 5 }}>Remove</button></p>}
    {error && <p role="alert" style={{ margin: '6px 0 0', padding: '7px 9px', fontSize: 11, fontWeight: 700 }}>{error}</p>}
    <style>{`
      .home-create-post,
      .home-create-post.ws-glass-panel,
      .home-create-post .ws-glass:not(button),
      .home-create-post .ws-glass-panel,
      .home-create-post textarea,
      .home-create-post input,
      .home-create-post p,
      .home-create-post-wrapper,
      .home-create-post-wrapper.ws-glass,
      .home-create-post-wrapper.ws-glass-panel {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
        border-color: transparent !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      /* The visible "card on card" can be the wrapper that directly owns this form. */
      /* Remove the actual glass/card ancestor that is painting the blue block. */
      :is(.ws-glass, .ws-glass-panel):has(.home-create-post),
      :is(.ws-glass, .ws-glass-panel):has(.home-create-post) * {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
        border-color: transparent !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      /* Keep the three attachment controls as the only visible cards. */
      .home-create-post .create-post-attachment-actions .create-post-attachment-btn {
        background: rgba(34, 211, 238, .055) !important;
        background-image: none !important;
        border: 1px solid rgba(66, 226, 255, .34) !important;
        box-shadow: 0 0 10px rgba(0, 195, 255, .12), inset 0 1px 0 rgba(255,255,255,.08) !important;
      }

      .home-create-post textarea {
        border: 0 !important;
        border-radius: 0 !important;
      }

      .create-post-attachment-actions .create-post-attachment-btn {
        min-height: 34px !important;
        padding: 0 11px !important;
        border: 1px solid rgba(66, 226, 255, .34) !important;
        border-radius: 10px !important;
        background: rgba(34, 211, 238, .055) !important;
        color: #bffbff !important;
        -webkit-text-fill-color: #bffbff !important;
        font-family: monospace, sans-serif !important;
        font-size: 10px !important;
        font-weight: 800 !important;
        letter-spacing: .015em !important;
        text-shadow: 0 0 8px rgba(76, 235, 255, .48) !important;
        box-shadow: 0 0 10px rgba(0, 195, 255, .12), inset 0 1px 0 rgba(255,255,255,.08) !important;
        transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease, background .16s ease !important;
      }
      .create-post-attachment-actions .create-post-attachment-media {
        border-color: rgba(91, 238, 255, .58) !important;
        background: rgba(34, 211, 238, .075) !important;
        box-shadow: 0 0 14px rgba(42, 224, 255, .22), inset 0 1px 0 rgba(255,255,255,.1) !important;
      }
      .create-post-attachment-actions .create-post-attachment-file {
        border-color: rgba(62, 165, 255, .52) !important;
        background: rgba(59, 130, 246, .065) !important;
        box-shadow: 0 0 13px rgba(50, 145, 255, .18), inset 0 1px 0 rgba(255,255,255,.08) !important;
      }
      .create-post-attachment-actions .create-post-attachment-location {
        border-color: rgba(76, 211, 255, .5) !important;
        background: rgba(34, 211, 238, .065) !important;
        box-shadow: 0 0 13px rgba(53, 202, 255, .18), inset 0 1px 0 rgba(255,255,255,.08) !important;
      }
      .create-post-attachment-actions .create-post-attachment-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        border-color: rgba(126, 247, 255, .92) !important;
        background: rgba(34, 211, 238, .12) !important;
        box-shadow: 0 0 20px rgba(58, 224, 255, .3), inset 0 1px 0 rgba(255,255,255,.14) !important;
      }
      .create-post-attachment-actions .create-post-attachment-btn:active:not(:disabled) {
        transform: translateY(0) scale(.98);
      }
      .create-post-attachment-actions .create-post-attachment-btn:disabled {
        opacity: .5 !important;
        filter: saturate(.55);
        box-shadow: none !important;
      }
    `}</style>
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import { createPost, type PostAttachmentInput, type PostLocationInput } from '../api/createPost';

interface CreatePostFormProps { profileId: string; onCreated: () => void; }
type SelectedFile = PostAttachmentInput & { preview: string };

const cardStyle: React.CSSProperties = { position: 'relative', overflow: 'hidden', padding: 18, border: '1px solid rgba(99,102,241,.16)', borderRadius: 22, background: 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(245,247,255,.96))', boxShadow: '0 14px 32px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.95)' };
const actionStyle: React.CSSProperties = { minHeight: 42, padding: '0 13px', border: '1px solid rgba(99,102,241,.14)', borderRadius: 14, background: 'linear-gradient(145deg, #fff, #eef2ff)', color: '#334155', fontWeight: 800, boxShadow: '0 5px 12px rgba(15,23,42,.08), inset 0 1px 1px rgba(255,255,255,.95)', cursor: 'pointer' };

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
    setSelectedFiles((current) => [...current, ...next]);
    event.target.value = '';
  }
  function onMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.target.files ?? []).map((file) => ({ file, kind: file.type.startsWith('video/') ? 'video' as const : 'image' as const, preview: URL.createObjectURL(file) }));
    setSelectedFiles((current) => [...current, ...next]);
    event.target.value = '';
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
  return <section style={cardStyle}>
    <div aria-hidden="true" style={{ position: 'absolute', top: -70, right: -60, width: 170, height: 170, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,.15), rgba(34,211,238,0))', pointerEvents: 'none' }} />
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
      <div><h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#17202a', letterSpacing: '-.02em' }}>Create post</h2><small style={{ display: 'block', marginTop: 3, color: '#64748b', fontWeight: 600 }}>Share something with your community</small></div>
      <span aria-hidden="true" style={{ width: 38, height: 38, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'linear-gradient(145deg, #67e8f9, #6366f1 58%, #a855f7)', boxShadow: 'inset 0 2px 2px rgba(255,255,255,.48), inset 0 -4px 7px rgba(49,46,129,.24), 0 7px 15px rgba(99,102,241,.24)' }}>✦</span>
    </header>
    <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="What's happening?" disabled={saving} style={{ width: '100%', minHeight: 104, boxSizing: 'border-box', resize: 'vertical', padding: 14, border: '1px solid rgba(100,116,139,.18)', borderRadius: 17, outline: 'none', background: 'rgba(255,255,255,.9)', color: '#17202a', fontSize: 15, lineHeight: 1.5, boxShadow: 'inset 0 2px 8px rgba(15,23,42,.035), 0 4px 12px rgba(15,23,42,.035)' }} />
    <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={onMedia} />
    <input ref={fileInputRef} type="file" hidden onChange={(event) => addFiles(event, 'file')} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
      <button type="button" onClick={chooseMedia} disabled={saving} style={{ ...actionStyle, color: '#2563eb' }}>📷 Photo / Video</button>
      <button type="button" onClick={chooseFile} disabled={saving} style={{ ...actionStyle, color: '#7c3aed' }}>📎 File</button>
      <button type="button" onClick={getLocation} disabled={saving || locationLoading} style={{ ...actionStyle, color: '#059669' }}>📍 {locationLoading ? 'Getting location…' : 'Location'}</button>
      <button type="button" onClick={() => void submit()} disabled={saving || !canPost} style={{ marginLeft: 'auto', minHeight: 42, padding: '0 19px', border: '1px solid rgba(255,255,255,.35)', borderRadius: 14, color: '#fff', fontWeight: 900, background: saving || !canPost ? 'linear-gradient(145deg, #94a3b8, #64748b)' : 'linear-gradient(145deg, #06b6d4, #2563eb 52%, #7c3aed)', boxShadow: saving || !canPost ? 'none' : 'inset 0 2px 2px rgba(255,255,255,.28), inset 0 -4px 8px rgba(30,64,175,.26), 0 8px 18px rgba(37,99,235,.25)', cursor: saving || !canPost ? 'not-allowed' : 'pointer' }}>{saving ? 'Posting…' : 'Post'}</button>
    </div>
    {selectedFiles.length > 0 && <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
      {selectedFiles.map((item, index) => <div key={`${item.file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: 8, borderRadius: 14, background: 'rgba(241,245,249,.8)' }}>
        {item.kind === 'image' ? <img src={item.preview} alt={item.file.name} width={72} height={72} style={{ objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} /> : item.kind === 'video' ? <video src={item.preview} width={120} height={72} controls style={{ maxWidth: '100%', borderRadius: 10, flexShrink: 0 }} /> : <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>📎 {item.file.name}</span>}
        <button type="button" onClick={() => setSelectedFiles((current) => current.filter((_, i) => i !== index))} disabled={saving} style={{ ...actionStyle, marginLeft: 'auto', minHeight: 34, padding: '0 10px', flexShrink: 0 }}>Remove</button>
      </div>)}
    </div>}
    {location && <p style={{ margin: '8px 0', padding: '9px 11px', borderRadius: 12, background: 'rgba(16,185,129,.08)', color: '#047857', fontSize: 13, fontWeight: 700 }}>📍 Location attached ({location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}) <button type="button" onClick={() => setLocation(null)} disabled={saving} style={{ ...actionStyle, minHeight: 30, marginLeft: 6, padding: '0 9px', color: '#047857' }}>Remove</button></p>}
    {error && <p role="alert" style={{ margin: '8px 0 0', padding: '9px 11px', borderRadius: 12, background: 'rgba(239,68,68,.08)', color: '#b91c1c', fontWeight: 700 }}>{error}</p>}
  </section>;
}

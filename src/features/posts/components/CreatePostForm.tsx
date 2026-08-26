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
  return <section>
    <h2>Create post</h2>
    <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="What's happening?" disabled={saving} />
    <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={onMedia} />
    <input ref={fileInputRef} type="file" hidden onChange={(event) => addFiles(event, 'file')} />
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
      <button type="button" onClick={chooseMedia} disabled={saving}>📷 Photo / Video</button>
      <button type="button" onClick={chooseFile} disabled={saving}>📎 File</button>
      <button type="button" onClick={getLocation} disabled={saving || locationLoading}>📍 {locationLoading ? 'Getting location…' : 'Location'}</button>
    </div>
    {selectedFiles.length > 0 && <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
      {selectedFiles.map((item, index) => <div key={`${item.file.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {item.kind === 'image' ? <img src={item.preview} alt={item.file.name} width={72} height={72} style={{ objectFit: 'cover', borderRadius: 8 }} /> : item.kind === 'video' ? <video src={item.preview} width={120} height={72} controls /> : <span>📎 {item.file.name}</span>}
        <button type="button" onClick={() => setSelectedFiles((current) => current.filter((_, i) => i !== index))} disabled={saving}>Remove</button>
      </div>)}
    </div>}
    {location && <p>📍 Location attached ({location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}) <button type="button" onClick={() => setLocation(null)} disabled={saving}>Remove</button></p>}
    <button type="button" onClick={() => void submit()} disabled={saving || !canPost}>{saving ? 'Posting…' : 'Post'}</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}

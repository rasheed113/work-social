import { useState } from 'react';
import { createPost } from '../api/createPost';

interface CreatePostFormProps { profileId: string; onCreated: () => void; }

export function CreatePostForm({ profileId, onCreated }: CreatePostFormProps) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const { error: createError } = await createPost(profileId, content);
    if (createError) setError(createError.message);
    else { setContent(''); onCreated(); }
    setSaving(false);
  }

  return <section>
    <h2>Create post</h2>
    <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="What's happening?" disabled={saving} />
    <button type="button" onClick={() => void submit()} disabled={saving || !content.trim()}>{saving ? 'Posting…' : 'Post'}</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}

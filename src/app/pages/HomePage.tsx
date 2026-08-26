import { useState } from 'react';
import { CreatePostForm } from '../../features/posts/components/CreatePostForm';
import { PostFeed } from '../../features/posts/components/PostFeed';

interface HomePageProps { profileId: string; }

export function HomePage({ profileId }: HomePageProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  return <main>
    <h1>Home</h1>
    <CreatePostForm profileId={profileId} onCreated={() => setRefreshKey((key) => key + 1)} />
    <PostFeed refreshKey={refreshKey} />
  </main>;
}

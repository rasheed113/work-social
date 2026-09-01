import 'package:flutter/material.dart';

import '../../posts/data/post_repository.dart';
import '../../posts/presentation/create_post_card.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.profileId});

  final String profileId;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _tab = 0;
  int _refreshKey = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 14,
        title: Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(13),
              gradient: const LinearGradient(colors: [Color(0xFF8FF3FF), Color(0xFF3B82F6), Color(0xFF6D3FE8)]),
              boxShadow: const [BoxShadow(color: Color(0x332563EB), blurRadius: 14, offset: Offset(0, 7))],
            ),
            alignment: Alignment.center,
            child: const Text('W', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18)),
          ),
          const SizedBox(width: 10),
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Work Social', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
            Text('CONNECT • CREATE • WORK', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: Color(0xFF64748B))),
          ]),
        ]),
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Icons.chat_bubble_outline_rounded)),
        ],
      ),
      body: IndexedStack(
        index: _tab,
        children: [
          _HomeFeed(profileId: widget.profileId, refreshKey: _refreshKey, onCreated: () => setState(() => _refreshKey++)),
          const Center(child: Text('Friends')),
          const Center(child: Text('Activity')),
          const Center(child: Text('Profile')),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (value) => setState(() => _tab = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'Friends'),
          NavigationDestination(icon: Icon(Icons.notifications_none), selectedIcon: Icon(Icons.notifications), label: 'Activity'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

class _HomeFeed extends StatelessWidget {
  const _HomeFeed({required this.profileId, required this.refreshKey, required this.onCreated});

  final String profileId;
  final int refreshKey;
  final VoidCallback onCreated;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onCreated(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(14, 18, 14, 112),
        children: [
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 16),
            child: Text('Home', style: TextStyle(fontSize: 38, height: 1.0, fontWeight: FontWeight.w900, letterSpacing: -1.4, color: Color(0xFF5B4BEA))),
          ),
          CreatePostCard(profileId: profileId, onCreated: onCreated),
          const SizedBox(height: 18),
          _PostFeed(profileId: profileId, refreshKey: refreshKey),
        ],
      ),
    );
  }
}

class _PostFeed extends StatefulWidget {
  const _PostFeed({required this.profileId, required this.refreshKey});

  final String profileId;
  final int refreshKey;

  @override
  State<_PostFeed> createState() => _PostFeedState();
}

class _PostFeedState extends State<_PostFeed> {
  final _client = PostRepository();
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void didUpdateWidget(covariant _PostFeed oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshKey != widget.refreshKey) _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final result = await _client.listPublicPosts();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: Padding(padding: EdgeInsets.all(30), child: CircularProgressIndicator()));
        }
        if (snapshot.hasError) {
          return _StateCard(message: snapshot.error.toString(), icon: Icons.error_outline);
        }
        final posts = snapshot.data ?? const <Map<String, dynamic>>[];
        if (posts.isEmpty) return const _StateCard(message: 'No posts yet. Be the first to share something.', icon: Icons.forum_outlined);
        return Column(children: posts.map((post) => _PostCard(post: post)).toList());
      },
    );
  }
}

class _PostCard extends StatelessWidget {
  const _PostCard({required this.post});
  final Map<String, dynamic> post;

  @override
  Widget build(BuildContext context) {
    final profile = (post['profiles'] as Map?)?.cast<String, dynamic>();
    final name = profile?['display_name']?.toString() ?? profile?['username']?.toString() ?? 'Work Social member';
    final content = post['content']?.toString() ?? '';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0x1699A2B8))),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CircleAvatar(radius: 22, backgroundImage: (profile?['avatar_url']?.toString().isNotEmpty ?? false) ? NetworkImage(profile!['avatar_url'].toString()) : null, child: profile?['avatar_url'] == null ? const Icon(Icons.person_outline) : null),
            const SizedBox(width: 10),
            Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w900))),
          ]),
          if (content.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(content, style: const TextStyle(fontSize: 15, height: 1.45)),
          ],
          if (post['location_name'] != null) ...[
            const SizedBox(height: 8),
            Text('📍 ${post['location_name']}', style: const TextStyle(fontSize: 12, color: Color(0xFF047857), fontWeight: FontWeight.w700)),
          ],
        ]),
      ),
    );
  }
}

class _StateCard extends StatelessWidget {
  const _StateCard({required this.message, required this.icon});
  final String message;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Card(margin: EdgeInsets.zero, child: Padding(padding: const EdgeInsets.all(24), child: Column(children: [Icon(icon, size: 34, color: Color(0xFF6D5DFC)), const SizedBox(height: 10), Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF64748B)))])));
}

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supabase/supabase_client.dart';

class PostDraft {
  const PostDraft({
    required this.content,
    this.latitude,
    this.longitude,
    this.locationName,
  });

  final String content;
  final double? latitude;
  final double? longitude;
  final String? locationName;
}

class PostRepository {
  const PostRepository();

  Future<List<Map<String, dynamic>>> listPublicPosts() async {
    final response = await supabase
        .from('posts')
        .select('id, profile_id, content, privacy, latitude, longitude, location_name, created_at, profiles(username, display_name, avatar_url)')
        .eq('privacy', 'public')
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  Future<void> createPost({
    required String profileId,
    required PostDraft draft,
  }) async {
    final normalizedContent = draft.content.trim();

    if (normalizedContent.isEmpty &&
        draft.latitude == null &&
        draft.longitude == null) {
      throw const PostRepositoryException('Post cannot be empty.');
    }

    final inserted = await supabase
        .from('posts')
        .insert({
          'profile_id': profileId,
          'content': normalizedContent,
          'latitude': draft.latitude,
          'longitude': draft.longitude,
          'location_name': draft.locationName,
        })
        .select()
        .single();

    if (inserted['id'] == null) {
      throw const PostRepositoryException('Post could not be created.');
    }
  }
}

class PostRepositoryException implements Exception {
  const PostRepositoryException(this.message);

  final String message;

  @override
  String toString() => message;
}

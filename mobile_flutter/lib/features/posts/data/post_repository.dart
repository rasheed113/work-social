import 'dart:typed_data';

import 'package:mime/mime.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import '../../../core/supabase/supabase_client.dart';

class PostDraft {
  const PostDraft({
    required this.content,
    this.latitude,
    this.longitude,
    this.locationName,
    this.attachments = const [],
  });

  final String content;
  final double? latitude;
  final double? longitude;
  final String? locationName;
  final List<PostAttachment> attachments;
}

class PostAttachment {
  const PostAttachment({
    required this.bytes,
    required this.fileName,
    required this.kind,
    this.mimeType,
  });

  final Uint8List bytes;
  final String fileName;
  final String kind;
  final String? mimeType;
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
    if (normalizedContent.isEmpty && draft.attachments.isEmpty && draft.latitude == null && draft.longitude == null) {
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

    final postId = inserted['id']?.toString();
    if (postId == null || postId.isEmpty) {
      throw const PostRepositoryException('Post could not be created.');
    }

    final uploadedPaths = <String>[];
    try {
      for (final attachment in draft.attachments) {
        final safeName = attachment.fileName.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
        final path = '$profileId/$postId/${const Uuid().v4()}-$safeName';
        final mimeType = attachment.mimeType ?? lookupMimeType(attachment.fileName);
        await supabase.storage.from('post-media').uploadBinary(
          path,
          attachment.bytes,
          fileOptions: FileOptions(upsert: false, contentType: mimeType),
        );
        uploadedPaths.add(path);

        await supabase.from('post_attachments').insert({
          'post_id': postId,
          'profile_id': profileId,
          'kind': attachment.kind,
          'storage_path': path,
          'file_name': attachment.fileName,
          'mime_type': mimeType,
          'file_size': attachment.bytes.length,
        });
      }
    } catch (error) {
      if (uploadedPaths.isNotEmpty) {
        await supabase.storage.from('post-media').remove(uploadedPaths);
      }
      await supabase.from('posts').delete().eq('id', postId);
      rethrow;
    }
  }
}

class PostRepositoryException implements Exception {
  const PostRepositoryException(this.message);
  final String message;
  @override
  String toString() => message;
}

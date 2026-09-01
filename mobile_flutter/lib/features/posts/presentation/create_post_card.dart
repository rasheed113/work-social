import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../data/post_repository.dart';

class CreatePostCard extends StatefulWidget {
  const CreatePostCard({super.key, required this.profileId, required this.onCreated});

  final String profileId;
  final VoidCallback onCreated;

  @override
  State<CreatePostCard> createState() => _CreatePostCardState();
}

class _CreatePostCardState extends State<CreatePostCard> {
  final _controller = TextEditingController();
  final _repository = const PostRepository();
  Position? _position;
  bool _locationLoading = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _getLocation() async {
    setState(() { _locationLoading = true; _error = null; });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('Location services are disabled.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        throw Exception('Location permission was not granted.');
      }
      _position = await Geolocator.getCurrentPosition();
    } catch (error) {
      _error = error.toString().replaceFirst('Exception: ', '');
    } finally {
      if (mounted) setState(() => _locationLoading = false);
    }
  }

  Future<void> _submit() async {
    final content = _controller.text.trim();
    if (content.isEmpty && _position == null) {
      setState(() => _error = 'Post cannot be empty.');
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      await _repository.createPost(
        profileId: widget.profileId,
        draft: PostDraft(
          content: content,
          latitude: _position?.latitude,
          longitude: _position?.longitude,
        ),
      );
      _controller.clear();
      _position = null;
      widget.onCreated();
    } on PostRepositoryException catch (error) {
      _error = error.message;
    } catch (error) {
      _error = error.toString();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPost = _controller.text.trim().isNotEmpty || _position != null;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0x1699A2B8))),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Create post', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900)), SizedBox(height: 2), Text('Share something with your community', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600))])),
            CircleAvatar(radius: 14, backgroundColor: Color(0xFF6D5DFC), child: Text('✦', style: TextStyle(color: Colors.white, fontSize: 13))),
          ]),
          const SizedBox(height: 7),
          TextField(
            controller: _controller,
            minLines: 2,
            maxLines: 6,
            enabled: !_saving,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(hintText: "What's happening?", filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(11), borderSide: const BorderSide(color: Color(0x1864748B))), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(11), borderSide: const BorderSide(color: Color(0x1864748B)))),
          ),
          const SizedBox(height: 6),
          Wrap(spacing: 5, runSpacing: 5, children: [
            OutlinedButton.icon(onPressed: _saving ? null : () {}, icon: const Icon(Icons.photo_camera_outlined, size: 16), label: const Text('Photo / Video', style: TextStyle(fontSize: 12))),
            OutlinedButton.icon(onPressed: _saving ? null : () {}, icon: const Icon(Icons.attach_file, size: 16), label: const Text('File', style: TextStyle(fontSize: 12))),
            OutlinedButton.icon(onPressed: _saving || _locationLoading ? null : _getLocation, icon: const Icon(Icons.location_on_outlined, size: 16), label: Text(_locationLoading ? 'Getting…' : 'Location', style: const TextStyle(fontSize: 12))),
            FilledButton(onPressed: _saving || !canPost ? null : _submit, child: Text(_saving ? 'Posting…' : 'Post')),
          ]),
          if (_position != null) ...[
            const SizedBox(height: 6),
            Text('📍 Location attached (${_position!.latitude.toStringAsFixed(5)}, ${_position!.longitude.toStringAsFixed(5)})', style: const TextStyle(color: Color(0xFF047857), fontSize: 11, fontWeight: FontWeight.w700)),
          ],
          if (_error != null) ...[
            const SizedBox(height: 6),
            Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 11, fontWeight: FontWeight.w700)),
          ],
        ]),
      ),
    );
  }
}

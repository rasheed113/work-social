import 'package:flutter/material.dart';

import 'app/work_social_app.dart';
import 'core/supabase/supabase_client.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeSupabase();
  runApp(const WorkSocialApp());
}

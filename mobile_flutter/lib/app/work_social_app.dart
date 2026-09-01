import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/auth/presentation/login_page.dart';
import '../features/home/presentation/home_page.dart';

class WorkSocialApp extends StatelessWidget {
  const WorkSocialApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Work Social',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6D5DFC)),
        scaffoldBackgroundColor: const Color(0xFFF7F8FC),
        fontFamily: 'sans',
      ),
      home: StreamBuilder<AuthState>(
        stream: Supabase.instance.client.auth.onAuthStateChange,
        builder: (context, snapshot) {
          final session = snapshot.data?.session ??
              Supabase.instance.client.auth.currentSession;
          if (session == null) return const LoginPage();
          return HomePage(profileId: session.user.id);
        },
      ),
    );
  }
}

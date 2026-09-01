class AppConfig {
  const AppConfig._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabasePublishableKey =
      String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');

  static void validate() {
    if (supabaseUrl.isEmpty || supabasePublishableKey.isEmpty) {
      throw StateError(
        'Missing Supabase configuration. Start Flutter with '
        '--dart-define=SUPABASE_URL=... and '
        '--dart-define=SUPABASE_PUBLISHABLE_KEY=...',
      );
    }
  }
}

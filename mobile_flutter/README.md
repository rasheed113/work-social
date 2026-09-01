# Work Social Flutter Mobile

This directory is the native Flutter implementation of the existing Work Social web application.

## Source of truth

The web application remains the behavioral and visual source of truth. The Flutter app must port the same authenticated identity, Supabase contracts, navigation, states, realtime behavior, and UI hierarchy rather than creating a separate product.

## Bootstrap

From the repository root:

```bash
flutter create --platforms=android --org com.rasheed113 mobile_flutter
cd mobile_flutter
flutter pub get
```

The generated Flutter platform files are intentionally not hand-written. After `flutter create`, keep the existing `lib/` and `pubspec.yaml` from this branch and merge the generated `android/` directory.

For the current Work Social Android application id, set the generated Android application id to:

```text
com.rasheed113.worksocial
```

Do not change the existing Android signing identity or package name.

## Run

Supply the public Supabase configuration at runtime rather than committing environment-specific configuration:

```bash
flutter run \
  --dart-define=SUPABASE_URL="<work-social-supabase-url>" \
  --dart-define=SUPABASE_PUBLISHABLE_KEY="<work-social-publishable-key>"
```

The existing web client uses PKCE, persistent sessions, and automatic token refresh. The Flutter Supabase client is initialized with the same PKCE contract.

## Current vertical slice

Implemented in this first increment:

1. Supabase initialization with runtime configuration.
2. Persistent Supabase authentication session handling.
3. Email/password sign-in and account creation.
4. Native Home shell with Work Social visual language.
5. Bottom navigation foundation for Home/Friends/Activity/Profile.
6. Public post feed query using the web application's `posts` relationship contract.
7. Create-post validation.
8. Post persistence to `posts`.
9. Post location capture using native Android location permission.
10. Native image/video/file selection and upload to the existing `post-media` bucket.
11. `post_attachments` persistence with rollback when storage/database attachment creation fails.

## Next increments

Port each web vertical slice from its existing API/UI contract:

- Friends and friend requests
- Notifications/activity and unread badges
- Profile/public profile/settings
- Inbox, conversations, realtime messaging, groups
- Voice/video calling and call controls
- Blocked users
- Worker/Work House pages
- Realtime subscriptions and lifecycle cleanup
- Android deep links/OAuth
- Push notifications
- Offline/retry/error states
- Release/CI verification and existing Android signing identity

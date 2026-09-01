import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _message;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    setState(() { _loading = true; _message = null; });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: _email.text.trim(),
        password: _password.text,
      );
    } on AuthException catch (error) {
      if (mounted) setState(() => _message = error.message);
    } catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signUp() async {
    setState(() { _loading = true; _message = null; });
    try {
      final response = await Supabase.instance.client.auth.signUp(
        email: _email.text.trim(),
        password: _password.text,
      );
      if (mounted && response.session == null) {
        setState(() => _message = 'Account created. Check your email to continue.');
      }
    } on AuthException catch (error) {
      if (mounted) setState(() => _message = error.message);
    } catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF7F8FC), Color(0xFFF3F4FA), Color(0xFFF4F8FA)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 438),
                child: Card(
                  elevation: 18,
                  shadowColor: Colors.black12,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('Work Social', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 2.4, color: Color(0xFF6D5DFC))),
                        const SizedBox(height: 10),
                        const Text('Welcome back', style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900, letterSpacing: -1.4)),
                        const SizedBox(height: 8),
                        const Text('Sign in to continue to your social workspace.', style: TextStyle(color: Color(0xFF667085))),
                        const SizedBox(height: 24),
                        TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: _input('Email')),
                        const SizedBox(height: 12),
                        TextField(controller: _password, obscureText: true, decoration: _input('Password')),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _loading ? null : _signIn,
                          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                          child: Text(_loading ? 'Signing in…' : 'Sign in'),
                        ),
                        const SizedBox(height: 10),
                        OutlinedButton(
                          onPressed: _loading ? null : _signUp,
                          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                          child: const Text('Create account'),
                        ),
                        if (_message != null) ...[
                          const SizedBox(height: 14),
                          Text(_message!, style: const TextStyle(color: Color(0xFFB4233C), fontWeight: FontWeight.w600)),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _input(String label) => InputDecoration(
    labelText: label,
    filled: true,
    fillColor: const Color(0xFFF9FAFC),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0x1A64748B))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0x1A64748B))),
  );
}

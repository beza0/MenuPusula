import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../config/env.dart';
import '../../core/errors.dart';
import '../../state/providers.dart';
import '../../widgets/media.dart';
import '../../widgets/state_views.dart';

enum AuthMode { login, signup, reset }

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});
  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  AuthMode _mode = AuthMode.login;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  static final _emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    final auth = ref.read(supabaseClientProvider).auth;
    final email = _email.text.trim();
    try {
      switch (_mode) {
        case AuthMode.login:
          await auth.signInWithPassword(email: email, password: _password.text);
          if (mounted) context.pop();
        case AuthMode.signup:
          final res = await auth.signUp(email: email, password: _password.text);
          if (res.session != null) {
            if (mounted) context.pop();
          } else {
            setState(() => _info = '$email adresine doğrulama bağlantısı gönderdik. Doğruladıktan sonra giriş yapabilirsiniz.');
          }
        case AuthMode.reset:
          await auth.resetPasswordForEmail(email, redirectTo: '${Env.publicWebUrl}/sifre-yenile');
          setState(() => _info = 'Bu adrese kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.');
      }
    } catch (e) {
      setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (_mode) { AuthMode.login => 'Giriş yap', AuthMode.signup => 'Kayıt ol', AuthMode.reset => 'Şifre sıfırlama' };
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Center(child: BrandLogo(size: 56)),
              const SizedBox(height: 24),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(labelText: 'E-posta'),
                validator: (v) => _emailRe.hasMatch(v?.trim() ?? '') ? null : 'Geçerli bir e-posta girin',
              ),
              if (_mode != AuthMode.reset) ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _password,
                  obscureText: true,
                  autofillHints: [_mode == AuthMode.login ? AutofillHints.password : AutofillHints.newPassword],
                  decoration: const InputDecoration(labelText: 'Şifre'),
                  validator: (v) => (v ?? '').length >= 8 ? null : 'Şifre en az 8 karakter olmalı',
                ),
              ],
              if (_mode == AuthMode.signup)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text('Kayıt olarak kullanım koşullarını ve gizlilik politikasını kabul etmiş olursunuz.', style: TextStyle(fontSize: 12)),
                ),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
              if (_info != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_info!)),
              const SizedBox(height: 16),
              FilledButton(onPressed: _busy ? null : _submit, child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text(title)),
              const SizedBox(height: 8),
              if (_mode == AuthMode.login) ...[
                TextButton(onPressed: () => setState(() => _mode = AuthMode.signup), child: const Text('Hesabınız yok mu? Kayıt olun')),
                TextButton(onPressed: () => setState(() => _mode = AuthMode.reset), child: const Text('Şifremi unuttum')),
              ] else
                TextButton(onPressed: () => setState(() => _mode = AuthMode.login), child: const Text('Giriş ekranına dön')),
            ]),
          ),
        ),
      ),
    );
  }
}

void requireLoginSnack(BuildContext context) => showSnack(context, 'Bu işlem için giriş yapın.');

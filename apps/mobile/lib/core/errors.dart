import 'dart:async';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

/// Hataları kullanıcıya anlaşılır Türkçe mesaja çevirir.
String friendlyError(Object error) {
  if (error is SocketException || error is TimeoutException || error is HttpException) {
    return 'İnternet bağlantısı yok veya sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.';
  }
  final text = error.toString();
  if (text.contains('ClientException') || text.contains('Failed host lookup') || text.contains('Connection refused')) {
    return 'İnternet bağlantısı yok veya sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.';
  }
  if (error is AuthException) {
    final m = error.message;
    if (m.contains('Invalid login credentials')) return 'E-posta veya şifre hatalı.';
    if (m.contains('Email not confirmed')) return 'E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu kontrol edin.';
    if (m.contains('already registered')) return 'Bu e-posta ile kayıtlı bir hesap var.';
    if (m.contains('Password should be')) return 'Şifre en az 8 karakter olmalı.';
    return m;
  }
  if (error is PostgrestException) {
    if (error.code == '23505') return 'Bu kayıt zaten mevcut.';
    if (error.code == '42501') return 'Bu işlem için yetkiniz yok.';
    return error.message;
  }
  if (error is FunctionException) {
    final details = error.details;
    if (details is Map && details['message'] is String) return details['message'] as String;
    return 'İşlem tamamlanamadı (${error.status}).';
  }
  return 'Beklenmeyen bir hata oluştu.';
}

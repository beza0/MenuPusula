import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoadingState } from './components/states';
import { RequireAdmin, RequireAuth } from './auth/AuthProvider';
import { supabaseConfigured } from './lib/supabase';
import { ConfigMissing } from './pages/ConfigMissing';

// Herkese açık QR menü ayrı parçaya bölünür; panel kodunu indirmez.
const PublicMenuPage = lazy(() => import('./pages/public/PublicMenuPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const BusinessListPage = lazy(() => import('./pages/panel/BusinessListPage'));
const BusinessNewPage = lazy(() => import('./pages/panel/BusinessNewPage'));
const BusinessPage = lazy(() => import('./pages/panel/BusinessPage'));
const AccountPage = lazy(() => import('./pages/panel/AccountPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const AdminBusinessPage = lazy(() => import('./pages/admin/AdminBusinessPage'));
const LegalPage = lazy(() => import('./pages/legal/LegalPage'));

export function App() {
  if (!supabaseConfigured) return <ConfigMissing />;
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/m/:publicId" element={<PublicMenuPage />} />
        <Route path="/giris" element={<LoginPage />} />
        <Route path="/kayit" element={<SignupPage />} />
        <Route path="/sifremi-unuttum" element={<ForgotPasswordPage />} />
        <Route path="/sifre-yenile" element={<ResetPasswordPage />} />
        <Route path="/gizlilik" element={<LegalPage kind="privacy" />} />
        <Route path="/kullanim-kosullari" element={<LegalPage kind="terms" />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/panel" element={<BusinessListPage />} />
          <Route path="/panel/isletme/yeni" element={<BusinessNewPage />} />
          <Route path="/panel/isletme/:id/:tab?" element={<BusinessPage />} />
          <Route path="/hesap" element={<AccountPage />} />
          <Route path="/admin/:section?" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/admin/isletme/:id" element={<RequireAdmin><AdminBusinessPage /></RequireAdmin>} />
        </Route>
        <Route path="/" element={<Navigate to="/panel" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-lg font-semibold">Sayfa bulunamadı</p>
      <a href="/panel" className="text-primary underline">Panele dön</a>
    </div>
  );
}

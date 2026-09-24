import { ConfigProvider } from 'antd';
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { AuthScreen } from '../screens/AuthScreen';
import { AccountProfileScreen } from '../screens/AccountProfileScreen';
import { BuyerCheckoutScreen } from '../screens/BuyerCheckoutScreen';
import { BuyerHomeScreen } from '../screens/BuyerHomeScreen';
import { BuyerAssistanceScreen } from '../screens/BuyerAssistanceScreen';
import { BuyerLicenseHubScreen } from '../screens/BuyerLicenseHubScreen';
import { BuyerOrdersScreen } from '../screens/BuyerOrdersScreen';
import { BuyerRenewalScreen } from '../screens/BuyerRenewalScreen';
import { CatalogScreen } from '../screens/CatalogScreen';
import { PublicHomeScreen } from '../screens/PublicHomeScreen';
import { ComparePlansScreen } from '../screens/ComparePlansScreen';
import { PaymentStatusScreen } from '../screens/PaymentStatusScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { PublicVerificationScreen } from '../screens/PublicVerificationScreen';
import { AiKnowledgeScreen } from '../screens/AiKnowledgeScreen';
import { ProviderCatalogScreen } from '../screens/ProviderCatalogScreen';
import { ProviderLicensesScreen } from '../screens/ProviderLicensesScreen';
import { ProviderDashboardScreen } from '../screens/ProviderDashboardScreen';
import { ProviderOperationsScreen } from '../screens/ProviderOperationsScreen';
import { SupportConsoleScreen } from '../screens/SupportConsoleScreen';
import { SystemConsoleScreen } from '../screens/SystemConsoleScreen';
import { PublicHelpScreen } from '../screens/PublicHelpScreen';
import { CustomerLayout } from '../components/CustomerLayout';
import {
  providerShell,
  RoleShell,
  supportShell,
  systemShell,
} from '../components/RoleShell';
import { AiAssistantLauncher } from '../components/AiAssistantLauncher';
import { antTheme, themeCssVariables, themeRootCss } from '../theme';
import { AuthProvider, useAuth } from '../../application/auth/authContext';

interface AppProps {
  readonly initialEntries?: readonly string[];
}

function testUserForEntries(initialEntries: readonly string[] | undefined) {
  if (!initialEntries) return undefined;
  const path = initialEntries[0] ?? '';
  const role = path.startsWith('/provider')
      ? 'PROVIDER_ADMIN'
      : path.startsWith('/buyer')
        ? 'CUSTOMER'
      : path.startsWith('/support')
        ? 'SUPPORT_STAFF'
        : path.startsWith('/system')
          ? 'SYSTEM_ADMIN'
          : null;
  return role
    ? { id: 'test-user', email: 'test@example.com', displayName: 'Test User', role, status: 'ACTIVE' }
    : null;
}

function ProtectedRoute({ children, roles }: { readonly children: ReactElement; readonly roles: string[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div role="status">Đang khôi phục phiên đăng nhập...</div>;
  if (user && roles.includes(user.role)) return children;
  const redirect = `${location.pathname}${location.search}`;
  return <Navigate replace to={`/auth?redirect=${encodeURIComponent(redirect)}`} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicHomeScreen />} path="/" />
      <Route element={<AuthScreen />} path="/auth" />
      <Route element={<CatalogScreen />} path="/products" />
      <Route element={<ComparePlansScreen />} path="/compare" />
      <Route element={<ProductDetailScreen />} path="/products/:slug" />
      <Route element={<PublicVerificationScreen />} path="/verify" />
      <Route element={<PublicHelpScreen />} path="/help" />
      <Route element={<ProtectedRoute roles={['CUSTOMER']}><CustomerLayout /></ProtectedRoute>} path="/buyer">
        <Route index element={<BuyerHomeScreen />} />
        <Route element={<CatalogScreen authenticated />} path="products" />
        <Route element={<ProductDetailScreen authenticated />} path="products/:slug" />
        <Route element={<BuyerCheckoutScreen />} path="checkout" />
        <Route element={<PaymentStatusScreen />} path="orders/:id/payment" />
        <Route element={<BuyerOrdersScreen />} path="orders" />
        <Route element={<BuyerLicenseHubScreen />} path="licenses" />
        <Route element={<BuyerRenewalScreen />} path="licenses/:licenseId/renew" />
        <Route element={<BuyerAssistanceScreen />} path="support" />
        <Route element={<AccountProfileScreen />} path="profile" />
      </Route>
      <Route element={<ProtectedRoute roles={['PROVIDER_ADMIN']}><RoleShell config={providerShell} /></ProtectedRoute>} path="/provider">
        <Route index element={<ProviderDashboardScreen />} />
        <Route element={<ProviderCatalogScreen />} path="catalog" />
        <Route element={<ProviderLicensesScreen />} path="licenses" />
        <Route element={<AccountProfileScreen />} path="profile" />
        <Route element={<AiKnowledgeScreen />} path="knowledge" />
        <Route element={<ProviderOperationsScreen />} path="operations" />
      </Route>
      <Route element={<ProtectedRoute roles={['SUPPORT_STAFF']}><RoleShell config={supportShell} /></ProtectedRoute>} path="/support">
        <Route index element={<SupportConsoleScreen />} />
        <Route element={<AccountProfileScreen />} path="profile" />
      </Route>
      <Route
        element={<ProtectedRoute roles={['SYSTEM_ADMIN']}><RoleShell config={systemShell} /></ProtectedRoute>}
        path="/system/console"
      >
        <Route index element={<SystemConsoleScreen />} />
        <Route element={<AccountProfileScreen />} path="profile" />
      </Route>
      <Route element={<Navigate replace to="/auth" />} path="*" />
    </Routes>
  );
}

export function App({ initialEntries }: AppProps) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const testUser = testUserForEntries(initialEntries);
  const routes = initialEntries ? (
    <MemoryRouter initialEntries={[...initialEntries]}>
      <AppRoutes />
    </MemoryRouter>
  ) : (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );

  return (
      <QueryClientProvider client={queryClient}>
      <AuthProvider {...(testUser === undefined ? {} : { initialUser: testUser })} skipBootstrap={initialEntries !== undefined}>
      <ConfigProvider theme={antTheme}>
      <style>{themeRootCss}</style>
      <div className="app-theme" style={themeCssVariables}>
        {routes}
        <AiAssistantLauncher />
      </div>
      </ConfigProvider>
      </AuthProvider>
      </QueryClientProvider>
  );
}

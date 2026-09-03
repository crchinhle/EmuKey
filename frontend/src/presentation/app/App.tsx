import { ConfigProvider } from 'antd';
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { AuthScreen } from '../screens/AuthScreen';
import { BuyerCheckoutScreen } from '../screens/BuyerCheckoutScreen';
import { BuyerHomeScreen } from '../screens/BuyerHomeScreen';
import { BuyerAssistanceScreen } from '../screens/BuyerAssistanceScreen';
import { BuyerLicenseHubScreen } from '../screens/BuyerLicenseHubScreen';
import { BuyerOrdersScreen } from '../screens/BuyerOrdersScreen';
import { CatalogScreen } from '../screens/CatalogScreen';
import { ContractSigningScreen } from '../screens/ContractSigningScreen';
import { PaymentStatusScreen } from '../screens/PaymentStatusScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { PublicVerificationScreen } from '../screens/PublicVerificationScreen';
import { AiKnowledgeScreen } from '../screens/AiKnowledgeScreen';
import { ProviderCatalogScreen } from '../screens/ProviderCatalogScreen';
import { ProviderDashboardScreen } from '../screens/ProviderDashboardScreen';
import { ProviderOperationsScreen } from '../screens/ProviderOperationsScreen';
import { ProviderSettingsScreen } from '../screens/ProviderSettingsScreen';
import { SupportConsoleScreen } from '../screens/SupportConsoleScreen';
import { SystemConsoleScreen } from '../screens/SystemConsoleScreen';
import {
  buyerShell,
  providerShell,
  RoleShell,
  supportShell,
  systemShell,
} from '../components/RoleShell';
import { antTheme, themeCssVariables, themeRootCss } from '../theme';

interface AppProps {
  readonly initialEntries?: readonly string[];
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthScreen />} path="/auth" />
      <Route element={<CatalogScreen />} path="/products" />
      <Route element={<ProductDetailScreen />} path="/products/:slug" />
      <Route element={<PublicVerificationScreen />} path="/verify" />
      <Route element={<RoleShell config={buyerShell} />} path="/buyer">
        <Route index element={<BuyerHomeScreen />} />
        <Route element={<BuyerCheckoutScreen />} path="checkout" />
        <Route element={<ContractSigningScreen />} path="contracts/:id/sign" />
        <Route element={<PaymentStatusScreen />} path="orders/:id/payment" />
        <Route element={<BuyerOrdersScreen />} path="orders" />
        <Route element={<BuyerLicenseHubScreen />} path="licenses" />
        <Route element={<BuyerAssistanceScreen />} path="support" />
      </Route>
      <Route element={<RoleShell config={providerShell} />} path="/provider">
        <Route index element={<ProviderDashboardScreen />} />
        <Route element={<ProviderSettingsScreen />} path="settings" />
        <Route element={<ProviderCatalogScreen />} path="catalog" />
        <Route element={<AiKnowledgeScreen />} path="knowledge" />
        <Route element={<ProviderOperationsScreen />} path="operations" />
      </Route>
      <Route element={<RoleShell config={supportShell} />} path="/support">
        <Route index element={<SupportConsoleScreen />} />
      </Route>
      <Route
        element={<RoleShell config={systemShell} />}
        path="/system/console"
      >
        <Route index element={<SystemConsoleScreen />} />
      </Route>
      <Route element={<Navigate replace to="/auth" />} path="*" />
    </Routes>
  );
}

export function App({ initialEntries }: AppProps) {
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
    <ConfigProvider theme={antTheme}>
      <style>{themeRootCss}</style>
      <div className="app-theme" style={themeCssVariables}>
        {routes}
      </div>
    </ConfigProvider>
  );
}

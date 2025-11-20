import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider } from '@shopify/polaris';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import SettingsPage from './pages/SettingsPage';

const App: React.FC = () => {
  // App Bridge configuration
  const appBridgeConfig = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY || '',
    host: new URLSearchParams(window.location.search).get('host') || '',
    forceRedirect: false,
  };

  return (
    <AppBridgeProvider config={appBridgeConfig}>
      <AppProvider i18n={{}}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<SettingsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AppBridgeProvider>
  );
};

export default App;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./lib/authContext";
import { RealtimeProvider } from "./lib/realtime";
import { ThemeProvider } from "./lib/themeContext";
import { ComposeProvider } from "./components/post/ComposeContext";
import { GuestGateProvider } from "./lib/guestGate";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { SuspensionGate } from "./components/shared/SuspensionGate";
import { PrivacyUpdateBanner } from "./components/shared/PrivacyUpdateBanner";
import { Toaster } from "./lib/toast";
import { initConsoleWarning } from "./lib/consoleWarning";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

initConsoleWarning();
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <RealtimeProvider>
              <GuestGateProvider>
                <ComposeProvider>
                  <PrivacyUpdateBanner />
                  <SuspensionGate />
                  <App />
                  <Toaster />
                </ComposeProvider>
              </GuestGateProvider>
            </RealtimeProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>
);

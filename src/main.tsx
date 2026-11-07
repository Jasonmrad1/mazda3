import {
  StrictMode,
  Component,
  lazy,
  Suspense,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
const App = lazy(() => import("./App"));
import { GarageProvider } from "./lib/store";
import { AuthGate } from "./components/AuthGate";
import "./styles.css";
import "./premium.css";
import "./interaction.css";
import "./showroom.css";
import "./collection.css";
import "./auth.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("Garage interface error", error.message);
  }
  render() {
    return this.state.error ? (
      <div className="loading-screen">
        <h1>Your garage needs a moment.</h1>
        <p>Your saved records are still on this device.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reopen garage
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent("garage-update-available", {
        detail: () => updateSW(true),
      }),
    );
  },
  onOfflineReady() {
    console.info("My Garage is ready offline.");
  },
});
if ("serviceWorker" in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (refreshing) return;
    const reload = async () => {
      refreshing = true;
      location.reload();
    };
    if (
      document.querySelector(".sign-in-page") &&
      !document.querySelector('form[aria-busy="true"]')
    )
      void reload();
    else
      window.dispatchEvent(
        new CustomEvent("garage-update-available", { detail: reload }),
      );
  });
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <GarageProvider>
          <Suspense
            fallback={
              <div className="loading-screen">
                <p>Opening your garage...</p>
              </div>
            }
          >
            <App />
          </Suspense>
        </GarageProvider>
      </AuthGate>
    </ErrorBoundary>
  </StrictMode>,
);

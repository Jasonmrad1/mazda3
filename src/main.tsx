import { StrictMode, Component, type ReactNode, type ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { GarageProvider } from "./lib/store";
import "./styles.css";
import "./premium.css";
import "./interaction.css";
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
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <GarageProvider>
        <App />
      </GarageProvider>
    </ErrorBoundary>
  </StrictMode>,
);

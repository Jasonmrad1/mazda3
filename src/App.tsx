import { MazdaIcon } from "./components/MazdaIcon";
import { useState, useEffect } from "react";
import {
  House,
  Wrench,
  Fuel,
  Sparkles,
  Bell,
  Settings,
  ChevronDown,
  ArrowUpRight,
  WifiOff,
  Download,
  ShieldCheck,
  Menu,
  PanelLeftClose,
} from "lucide-react";
import { useGarage } from "./lib/store";
import type { Tab } from "./lib/types";
import { photos } from "./lib/types";
import { dueAlerts } from "./lib/reminders";
import { Home } from "./features/Home";
import { Care } from "./features/Care";
import { Fuel as FuelPage } from "./features/Fuel";
import { Garage } from "./features/Garage";
import { Assistant, ArticleModal } from "./features/Assistant";
import { Onboarding } from "./features/Onboarding";
import { Editor } from "./components/Editors";
import type { ModalState } from "./components/ui";
const nav = [
  { id: "home", label: "Home", mobile: "Home", icon: House },
  { id: "care", label: "Care", mobile: "Care", icon: Wrench },
  { id: "fuel", label: "Fuel", mobile: "Fuel", icon: Fuel },
  { id: "garage", label: "Garage", mobile: "Garage", icon: MazdaIcon },
  {
    id: "assistant",
    label: "Assistant",
    mobile: "Assistant",
    icon: Sparkles,
  },
] as const;
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
function readLocation() {
  const params = new URLSearchParams(location.search);
  const t = params.get("tab");
  return {
    tab: (nav.some((n) => n.id === t) ? t : "home") as Tab,
    section: params.get("section") ?? undefined,
  };
}
export default function App() {
  const { data, update, toast } = useGarage();
  const [route, setRoute] = useState(readLocation),
    [modal, setModal] = useState<ModalState | null>(null),
    [offline, setOffline] = useState(!navigator.onLine),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [sidebar, setSidebar] = useState(false),
    [appUpdate, setAppUpdate] = useState<(() => Promise<void>) | null>(null);
  useEffect(() => {
    const onPop = () => setRoute(readLocation());
    const onOnline = () => setOffline(!navigator.onLine);
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const onUpdate = (event: Event) => {
      const apply = (event as CustomEvent<() => Promise<void>>).detail;
      if (typeof apply === "function") setAppUpdate(() => apply);
    };
    window.addEventListener("garage-update-available", onUpdate);
    window.addEventListener("popstate", onPop);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("garage-update-available", onUpdate);
    };
  }, []);
  const navigate = (tab: Tab, section?: string) => {
    const params = new URLSearchParams();
    if (tab !== "home") params.set("tab", tab);
    if (section) params.set("section", section);
    history.pushState(
      null,
      "",
      location.pathname + (params.size ? "?" + params.toString() : ""),
    );
    setRoute({ tab, section });
    setSidebar(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const alerts = dueAlerts(data);
  const open = (m: ModalState) => setModal(m);
  return (
    <div
      className={`app-shell ${route.tab === "home" ? "showroom-shell" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${sidebar ? "mobile-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="My Garage home"
        >
          <span className="brand-icon">
            <MazdaIcon size={25} strokeWidth={1.3} />
          </span>
          <span>
            MY GARAGE<small>YOUR MAZDA COMPANION</small>
          </span>
        </button>
        <div className="sidebar-label">YOUR COMPANION</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              aria-current={route.tab === n.id ? "page" : undefined}
              className={`nav-item ${route.tab === n.id ? "active" : ""}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} strokeWidth={1.6} />
              <span>{n.label}</span>
              {n.id === "care" && alerts.length > 0 && <b>{alerts.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-garage">
          <div className="sidebar-car-image">
            <img src={data.vehicle.photo || photos[0]} alt="Your Mazda3" />
          </div>
          <span className="eyebrow">PARKED IN YOUR GARAGE</span>
          <strong>
            {data.vehicle.specs.Year} {data.vehicle.specs.Model}
          </strong>
          <small>{data.vehicle.specs.Exterior}</small>
          <button
            className="text-button"
            onClick={() => open({ type: "profile" })}
          >
            Vehicle details
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          {install && (
            <button
              onClick={async () => {
                await install.prompt();
                const result = await install.userChoice;
                if (result.outcome === "accepted") {
                  setInstall(null);
                  toast("My Garage added to your device");
                }
              }}
            >
              <Download size={17} />
              Install My Garage
            </button>
          )}
          <button onClick={() => open({ type: "settings" })}>
            <Settings size={17} />
            Settings
          </button>
          <div>
            <i className="status-dot green" />
            LOCAL-FIRST. ALWAYS YOURS.
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu size={21} />
            </button>
            <span className="topbar-greeting">YOUR DIGITAL GARAGE</span>
            <span className="breadcrumb-separator">/</span>
            <span>{nav.find((n) => n.id === route.tab)?.label}</span>
          </div>
          <div className="topbar-right">
            <span className="today-label">
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="local-status">
              <i className="status-dot green" />
              {offline ? "OFFLINE · SAVED LOCALLY" : "SAVED ON THIS DEVICE"}
            </span>
            <button
              className="notification-button icon-button"
              aria-label={`Care reminders, ${alerts.length} due`}
              onClick={() => navigate("care", "reminders")}
            >
              <Bell size={19} />
              {alerts.length > 0 && <i />}
            </button>
            <button
              className="avatar"
              aria-label="Open garage settings"
              onClick={() => open({ type: "settings" })}
            >
              MG
            </button>
          </div>
        </header>
        {offline && (
          <div className="offline-banner">
            <WifiOff size={14} />
            You’re offline. Your garage records, photos and care tools are still
            here.
          </div>
        )}
        {appUpdate && (
          <div className="app-update-banner" role="status">
            <span>A fresh version of your garage is ready.</span>
            <button
              onClick={() =>
                void appUpdate().catch(() =>
                  toast("Close and reopen the app to finish updating."),
                )
              }
            >
              Update now
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        <main
          id="main"
          key={`${route.tab}-${route.section ?? ""}`}
          className="main-content"
        >
          {route.tab === "home" ? (
            <Home open={open} navigate={navigate} />
          ) : route.tab === "care" ? (
            <Care open={open} initialSection={route.section} />
          ) : route.tab === "fuel" ? (
            <FuelPage open={open} />
          ) : route.tab === "garage" ? (
            <Garage open={open} initialSection={route.section} />
          ) : (
            <Assistant open={open} />
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <button
            key={n.id}
            className={route.tab === n.id ? "active" : ""}
            onClick={() => navigate(n.id)}
            aria-current={route.tab === n.id ? "page" : undefined}
          >
            <n.icon size={21} strokeWidth={1.6} />
            <span>{n.mobile}</span>
          </button>
        ))}
      </nav>
      {modal &&
        (modal.type === "onboarding" ? (
          <Onboarding onClose={() => setModal(null)} />
        ) : modal.type === "learn" ? (
          <ArticleModal
            subject={modal.subject ?? "tires"}
            onClose={() => setModal(null)}
          />
        ) : (
          <Editor
            key={JSON.stringify(modal)}
            state={modal}
            onClose={() => setModal(null)}
          />
        ))}
    </div>
  );
}

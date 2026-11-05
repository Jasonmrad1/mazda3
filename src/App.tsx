import { MazdaIcon } from "./components/MazdaIcon";
import { useState, useEffect } from "react";
import {
  House,
  Wrench,
  Fuel,
  Sparkles,
  Bell,
  Settings,
  ArrowUpRight,
  WifiOff,
  Download,
  Menu,
  X,
} from "lucide-react";
import { useGarage } from "./lib/store";
import type { Tab } from "./lib/types";
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
      <div className="main-shell">
        <header className="topbar collection-header">
          <button className="collection-brand" onClick={() => navigate("home")} aria-label="My Garage home">
            <MazdaIcon size={43} />
            <span>MY GARAGE<small>THE MAZDA COLLECTION</small></span>
          </button>
          <nav className="collection-nav" aria-label="Main navigation">
            {nav.map(n => <button key={n.id} aria-current={route.tab===n.id?"page":undefined} onClick={() => navigate(n.id)}>{n.label}<span aria-hidden="true" /></button>)}
          </nav>
          <div className="collection-tools">
            <span className="collection-wordmark">MAZDA</span>
            {install && <button className="icon-button collection-install" aria-label="Install My Garage" onClick={async () => {await install.prompt();const result=await install.userChoice;if(result.outcome==="accepted"){setInstall(null);toast("My Garage added to your device");}}}><Download size={18}/></button>}
            <button className="notification-button icon-button" aria-label={"Care reminders, "+alerts.length+" due"} onClick={() => navigate("care","reminders")}><Bell size={18}/>{alerts.length>0&&<i/>}</button>
            <button className="icon-button" aria-label="Open garage settings" onClick={() => open({type:"settings"})}><Settings size={18}/></button>
            <button className="icon-button collection-menu" aria-label={sidebar?"Close navigation":"Open navigation"} aria-expanded={sidebar} onClick={() => setSidebar(!sidebar)}>{sidebar?<X size={21}/>:<Menu size={21}/>}</button>
          </div>
          {sidebar && <nav className="collection-mobile-nav" aria-label="Compact navigation">{nav.map(n => <button key={n.id} aria-current={route.tab===n.id?"page":undefined} onClick={() => navigate(n.id)}>{n.label}<ArrowUpRight size={14}/></button>)}</nav>}
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

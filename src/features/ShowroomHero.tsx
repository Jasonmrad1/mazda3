import { MazdaIcon } from "../components/MazdaIcon";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Camera,
  ChevronRight,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { useGarage } from "../lib/store";
import type { Tab } from "../lib/types";
import type { OpenModal } from "../components/ui";
import { CarStudio } from "./CarStudio";

export function ShowroomHero({
  onPhotos,
  open,
  navigate,
}: {
  onPhotos: () => void;
  open: OpenModal;
  navigate: (tab: Tab, section?: string) => void;
}) {
  const { data } = useGarage();
  const [menu, setMenu] = useState(false),
    [view, setView] = useState<"exterior" | "interior">("exterior");
  const go = (tab: Tab) => {
    setMenu(false);
    navigate(tab);
  };
  const enter = () =>
    document.getElementById("garage-overview")?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  return (
    <section className="showroom-hero" aria-label="Mazda3 immersive 3D hero">
      <header className="showroom-header">
        <button
          className="showroom-brand"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="My Garage home"
        >
          <MazdaIcon size={24} strokeWidth={1.2} />
          <span>
            MY GARAGE<small>THE MAZDA COLLECTION · 01</small>
          </span>
        </button>
        <nav aria-label="Showroom navigation">
          {(["home", "care", "fuel", "garage", "assistant"] as Tab[]).map(
            (tab) => (
              <button
                key={tab}
                className={tab === "home" ? "active" : ""}
                onClick={() => go(tab)}
              >
                {tab === "home"
                  ? "Overview"
                  : tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ),
          )}
        </nav>
        <div className="showroom-header-end">
          <span>MAZDA</span>
          <button
            className="icon-button"
            aria-label="Open garage settings"
            onClick={() => open({ type: "settings" })}
          >
            <Settings size={18} />
          </button>
          <button
            className="icon-button showroom-menu-toggle"
            aria-label={menu ? "Close showroom menu" : "Open showroom menu"}
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      {menu && (
        <nav
          className="showroom-mobile-menu"
          aria-label="Showroom mobile navigation"
        >
          {(["home", "care", "fuel", "garage", "assistant"] as Tab[]).map(
            (tab) => (
              <button key={tab} onClick={() => go(tab)}>
                {tab[0].toUpperCase() + tab.slice(1)}
                <ChevronRight size={16} />
              </button>
            ),
          )}
        </nav>
      )}
      <div className="showroom-watermark" aria-hidden="true">
        MAZDA3
      </div>
      <div className="showroom-car">
        <CarStudio hero view={view} onPhotos={onPhotos} />
      </div>
      <div className="showroom-intro">
        <span className="eyebrow">2019 · BP HATCHBACK</span>
        <h1>
          MAZDA<span>3</span>
        </h1>
        <p className="showroom-edition">JET BLACK MICA</p>
        <p className="showroom-line">
          An expression of you.
          <br />A garage made for your Mazda.
        </p>
        <div className="showroom-ctas">
          <button className="button primary" onClick={enter}>
            Enter my garage
            <ArrowDown size={16} />
          </button>
          <button className="showroom-photo-button" onClick={onPhotos}>
            <Camera size={16} />
            Your photographs
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
      <div className="showroom-view-switch" aria-label="Vehicle perspective">
        <button
          className={view === "exterior" ? "active" : ""}
          aria-pressed={view === "exterior"}
          onClick={() => setView("exterior")}
        >
          Exterior<span aria-hidden="true">01</span>
        </button>
        <button
          className={view === "interior" ? "active" : ""}
          aria-pressed={view === "interior"}
          onClick={() => setView("interior")}
        >
          Interior<span aria-hidden="true">02</span>
        </button>
      </div>
      <div className="showroom-specs">
        <div>
          <span>ENGINE</span>
          <strong>2.5 SKYACTIV-G</strong>
        </div>
        <div>
          <span>TRANSMISSION</span>
          <strong>6-speed automatic</strong>
        </div>
        <div>
          <span>INTERIOR</span>
          <strong>{data.vehicle.specs.Interior || "Not entered"}</strong>
        </div>
        <button onClick={() => open({ type: "profile" })}>
          Your vehicle details
          <ArrowUpRight size={15} />
        </button>
      </div>
      {!data.settings.onboardingDone && (
        <button
          className="showroom-setup"
          onClick={() => open({ type: "onboarding" })}
        >
          Personalize your garage
          <ArrowUpRight size={13} />
        </button>
      )}
      <button
        className="showroom-scroll"
        onClick={enter}
        aria-label="Scroll to your garage tools"
      >
        <span>YOUR JOURNEY CONTINUES</span>
        <ArrowDown size={18} />
      </button>
    </section>
  );
}

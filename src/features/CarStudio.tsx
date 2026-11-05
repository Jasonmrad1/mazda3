import { useEffect, useRef, useState } from "react";
import {
  RotateCcw,
  RotateCw,
  Maximize,
  Move,
  WifiOff,
  ExternalLink,
  Box,
  Camera,
  LoaderCircle,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import { useGarage } from "../lib/store";
import { photos } from "../lib/types";
import { referenceModel, modelOptions } from "../data/models3d";

type Vector = [number, number, number];
type CameraPose = { position: Vector; target: Vector };
type Material = {
  name: string;
  channels: Record<
    string,
    { color?: number[]; factor?: number; enable?: boolean; texture?: unknown }
  >;
  stateSetID: number;
};
export interface ViewerApi {
  start: () => void;
  stop?: () => void;
  addEventListener: (name: string, fn: () => void) => void;
  getCameraLookAt: (fn: (error: unknown, camera: CameraPose) => void) => void;
  setCameraLookAt: (
    position: Vector,
    target: Vector,
    duration: number,
    fn?: () => void,
  ) => void;
  getMaterialList: (
    fn: (error: unknown, materials: Material[]) => void,
  ) => void;
  setMaterial: (material: Material, fn?: () => void) => void;
  setBackground: (options: { color: number[] }, fn?: () => void) => void;
  setEnableCameraConstraints: (enabled: boolean) => void;
  setFov: (value: number, fn?: () => void) => void;
}
declare global {
  interface Window {
    Sketchfab?: new (iframe: HTMLIFrameElement) => {
      init: (id: string, options: Record<string, unknown>) => void;
    };
  }
}
let scriptPromise: Promise<void> | undefined;
function loadViewerApi() {
  if (window.Sketchfab) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
    script.async = true;
    script.onload = () =>
      window.Sketchfab ? resolve() : reject(Error("Viewer API unavailable"));
    script.onerror = () => reject(Error("Viewer could not connect"));
    document.head.append(script);
  }).catch((e) => {
    scriptPromise = undefined;
    throw e;
  });
  return scriptPromise;
}
export function CarStudio({
  onPhotos,
  hero = false,
  view = "exterior",
}: {
  onPhotos: () => void;
  hero?: boolean;
  view?: "exterior" | "interior";
}) {
  const { data } = useGarage();
  const frame = useRef<HTMLIFrameElement>(null),
    stage = useRef<HTMLDivElement>(null),
    api = useRef<ViewerApi | null>(null),
    original = useRef<CameraPose | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [status, setStatus] = useState<
      "loading" | "ready" | "error" | "offline"
    >(navigator.onLine ? "loading" : "offline"),
    [attempt, setAttempt] = useState(0),
    [blackPaint, setBlackPaint] = useState(false),
    [graphicsError, setGraphicsError] = useState(false);
  useEffect(() => {
    let active = true,
      timer: ReturnType<typeof setTimeout>;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("loading");
    setBlackPaint(false);
    setGraphicsError(false);
    api.current = null;
    timer = setTimeout(() => {
      if (active) setStatus((s) => (s === "ready" ? s : "error"));
    }, 40000);
    loadViewerApi()
      .then(() => {
        if (!active || !frame.current || !window.Sketchfab) return;
        const client = new window.Sketchfab(frame.current);
        client.init(referenceModel.id, {
          autostart: 1,
          autospin: 0,
          camera: 0,
          max_texture_size: matchMedia("(max-width:760px)").matches
            ? 512
            : 2048,
          dnt: 1,
          transparent: 1,
          ui_infos: 0,
          ui_hint: 0,
          ui_animations: 0,
          ui_help: 0,
          ui_settings: 0,
          ui_vr: 0,
          ui_ar: 0,
          ui_fullscreen: 0,
          success: (viewer: ViewerApi) => {
            if (!active) return;
            api.current = viewer;
            viewer.addEventListener("viewerready", () => {
              if (!active) return;
              viewer.setBackground({ color: [0.016, 0.016, 0.016] });
              viewer.getCameraLookAt((error, camera) => {
                if (!error && active) {
                  const factor = hero ? 0.36 : 0.45;
                  const pose: CameraPose = {
                    target: camera.target,
                    position: camera.position.map(
                      (value, i) =>
                        camera.target[i] + (value - camera.target[i]) * factor,
                    ) as Vector,
                  };
                  original.current = pose;
                  if (viewRef.current === "exterior")
                    viewer.setCameraLookAt(pose.position, pose.target, 0);
                }
              });
              viewer.getMaterialList((error, materials) => {
                if (error || !active) return;
                for (const material of materials) {
                  // Keep the upholstery maps and stitching, tinting the texture
                  // rather than replacing it with an untextured black surface.
                  if (/MI_(Leather_Inst|ChangeA_Cabin|Fablic)/i.test(material.name)) {
                    for (const key of ["AlbedoPBR", "DiffuseColor", "DiffusePBR"]) {
                      const upholstery = material.channels[key];
                      if (upholstery) upholstery.factor = Math.min(upholstery.factor ?? 1, 0.42);
                    }
                    viewer.setMaterial(material);
                    continue;
                  }
                  if (!/car.?paint|^body$|MI_1218030001/i.test(material.name)) continue;
                  const channel =
                    material.channels.AlbedoPBR ??
                    material.channels.DiffuseColor;
                  if (channel) {
                    delete channel.texture;
                    channel.color = [0.006, 0.006, 0.006];
                    channel.factor = 1;
                    for (const key of [
                      "AlbedoPBR",
                      "DiffuseColor",
                      "DiffusePBR",
                    ]) {
                      const paint = material.channels[key];
                      if (paint) {
                        delete paint.texture;
                        paint.color = [0.006, 0.006, 0.006];
                        paint.factor = 1;
                      }
                    }
                    if (material.channels.RoughnessPBR)
                      material.channels.RoughnessPBR.factor = 0.07;
                    if (material.channels.MetalnessPBR)
                      material.channels.MetalnessPBR.factor = 0.32;
                    viewer.setMaterial(material, () => {
                      if (active) {
                        setBlackPaint(true);
                        setStatus("ready");
                        clearTimeout(timer);
                      }
                    });
                  }
                }
              });
            });
            viewer.start();
          },
          error: (error: unknown) => {
            if (active) {
              clearTimeout(timer);
              setGraphicsError(/webgl|hardware/i.test(String(error)));
              setStatus("error");
            }
          },
        });
      })
      .catch(() => {
        if (active) {
          clearTimeout(timer);
          setStatus("error");
        }
      });
    return () => {
      active = false;
      clearTimeout(timer);
      api.current?.stop?.();
      api.current = null;
    };
  }, [attempt]);
  const cabinPose = (rear = false) => {
    const viewer = api.current;
    if (!viewer) return;
    viewer.setFov(75);
    viewer.setCameraLookAt(
      rear ? [0.0035, 0.012, 0.009] : [0.0035, 0.002, 0.0105],
      rear ? [0.001, -0.008, 0.006] : [0.001, -0.01, 0.007],
      matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 0.8,
    );
  };
  useEffect(() => {
    if (status !== "ready" || !api.current) return;
    const viewer = api.current;
    viewer.setEnableCameraConstraints(false);
    if (view === "interior") cabinPose();
    else if (original.current) {
      viewer.setFov(45);
      viewer.setCameraLookAt(
        original.current.position,
        original.current.target,
        0.8,
      );
    }
  }, [view, status]);
  useEffect(() => {
    const offline = () => setStatus("offline");
    window.addEventListener("offline", offline);
    return () => window.removeEventListener("offline", offline);
  }, []);
  const rotate = (angle: number) => {
    api.current?.getCameraLookAt((error, camera) => {
      if (error) return;
      if (view === "interior") {
        const x = camera.target[0] - camera.position[0],
          y = camera.target[1] - camera.position[1];
        api.current?.setCameraLookAt(
          camera.position,
          [
            camera.position[0] + x * Math.cos(angle) - y * Math.sin(angle),
            camera.position[1] + x * Math.sin(angle) + y * Math.cos(angle),
            camera.target[2],
          ],
          matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 0.8,
        );
        return;
      }
      const x = camera.position[0] - camera.target[0],
        y = camera.position[1] - camera.target[1];
      api.current?.setCameraLookAt(
        [
          camera.target[0] + x * Math.cos(angle) - y * Math.sin(angle),
          camera.target[1] + x * Math.sin(angle) + y * Math.cos(angle),
          camera.position[2],
        ],
        camera.target,
        matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 0.8,
      );
    });
  };
  return (
    <div
      className={`car-studio ${hero ? "hero-studio" : ""} ${view === "interior" ? "interior-view" : ""}`}
    >
      <div
        className="studio-stage"
        ref={stage}
        aria-label="Interactive whole-car 3D explorer"
      >
        <div className="studio-heading">
          <span className="eyebrow">THE MAZDA3, FROM EVERY ANGLE</span>
          <h2>Beauty in every line.</h2>
          <span className="studio-live">
            <i />
            {status === "ready" ? "INTERACTIVE 3D" : "2019 · BP HATCHBACK"}
          </span>
        </div>
        <div className="studio-orbit" aria-hidden="true" />
        <iframe
          ref={frame}
          title="2020 Mazda3 BP Hatchback interactive 3D reference model"
          className={status === "ready" ? "ready" : ""}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {status === "loading" && (
          <div className="studio-loading" role="status">
            <Box size={35} strokeWidth={1} />
            <h3>Bringing every curve into focus.</h3>
            <p>Loading the whole-car model from Sketchfab…</p>
            <span className="studio-progress" />
            <small>Your care records stay on this device.</small>
          </div>
        )}
        {(status === "error" || status === "offline") && (
          <div className="studio-fallback">
            <img
              src={data.vehicle.photo || photos[data.vehicle.photoIndex]}
              alt="Your Mazda3 photograph"
            />
            <div>
              {status === "offline" ? <WifiOff size={28} /> : <Box size={28} />}
              <h3>
                {status === "offline"
                  ? "Your photos are always here."
                  : "The 3D studio could not connect."}
              </h3>
              <p>
                {status === "offline"
                  ? "The hosted 3D model needs internet. Your photos and care tools work offline."
                  : graphicsError
                    ? "This browser could not provide hardware-accelerated 3D. Enable graphics acceleration or try a supported browser. Your photos and care tools remain available."
                    : "Sketchfab may be blocked by your browser or network. Try again, or open the model directly."}
              </p>
              <div className="inline-actions">
                <button className="button primary" onClick={onPhotos}>
                  <Camera size={16} />
                  Back to my photos
                </button>
                {status === "error" && (
                  <button
                    className="button secondary"
                    onClick={() => setAttempt((v) => v + 1)}
                  >
                    Try again
                  </button>
                )}
              </div>
              <a
                href={referenceModel.url}
                target="_blank"
                rel="noreferrer"
                className="text-button"
              >
                Open on Sketchfab
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        )}
        {status === "ready" && (
          <>
            <div className="studio-hint">
              <Move size={15} />
              <span>Drag to rotate · scroll or pinch to zoom</span>
            </div>
            <div className="studio-controls">
              {view === "interior" && (
                <>
                  <button onClick={() => cabinPose()}>Driver</button>
                  <button onClick={() => cabinPose(true)}>Rear cabin</button>
                  <span />
                </>
              )}
              <button
                aria-label="Rotate car left"
                onClick={() => rotate(Math.PI / 4)}
              >
                <RotateCcw size={17} />
              </button>
              <button
                aria-label="Reset car view"
                onClick={() => {
                  if (view === "interior") {
                    cabinPose();
                    return;
                  }
                  if (original.current)
                    api.current?.setCameraLookAt(
                      original.current.position,
                      original.current.target,
                      matchMedia("(prefers-reduced-motion:reduce)").matches
                        ? 0
                        : 0.8,
                    );
                }}
              >
                Reset view
              </button>
              <button
                aria-label="Rotate car right"
                onClick={() => rotate(-Math.PI / 4)}
              >
                <RotateCw size={17} />
              </button>
              <span />
              <button
                aria-label="Fullscreen car model"
                onClick={() => {
                  if (document.fullscreenElement)
                    void document.exitFullscreen();
                  else void stage.current?.requestFullscreen().catch(() => {});
                }}
              >
                <Maximize size={17} />
              </button>
            </div>
          </>
        )}
      </div>
      <div className="studio-source">
        <span>
          <Box size={13} />
          Reference model by{" "}
          <a href={referenceModel.url} target="_blank" rel="noreferrer">
            {referenceModel.author} · Sketchfab
            <ArrowUpRight size={12} />
          </a>
        </span>
        <small>
          {blackPaint
            ? "Black body finish applied · 2020 BP reference · trim may differ"
            : "Reference appearance · color, wheels and interior may differ"}
        </small>
      </div>
      <details className="model-catalog">
        <summary>
          <span>
            <Box size={16} />
            Explore the model options
          </span>
          <ChevronDown size={16} />
        </summary>
        <p>
          The embedded reference is hosted by its author; no model file is
          copied into your garage. These are the exact-generation options found.
          No purchase has been made.
        </p>
        <div>
          {modelOptions.map((model) => (
            <article key={model.url}>
              <span className="eyebrow">{model.type}</span>
              <h3>{model.name}</h3>
              <span className="model-author">{model.author}</span>
              <p>{model.detail}</p>
              <a
                className="text-button"
                href={model.url}
                target="_blank"
                rel="noreferrer"
              >
                {model.label}
                <ArrowUpRight size={15} />
              </a>
            </article>
          ))}
        </div>
        <small>
          Listings checked 5 November 2026. Confirm current pricing and
          permitted app use with the seller. The 3D model is a visual reference,
          not vehicle measurements or a certified digital twin.
        </small>
      </details>
    </div>
  );
}

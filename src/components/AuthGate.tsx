import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { supabase, url, key } from "../lib/supabase";
import { boundedFetch, within } from "../lib/requestTimeout";
import { MazdaIcon } from "./MazdaIcon";

const offlineIdentity = "my-garage-last-authenticated-user";
async function requireMembership(id: string, token: string) {
  if (!url || !key) throw Error("Sign-in is not configured.");
  // Use the token already returned by sign-in rather than starting another
  // session lookup while the Auth SDK is notifying its subscribers.
  const client = createClient(url, key, {
    accessToken: async () => token,
    global: { fetch: boundedFetch },
  });
  const { data, error } = await client
    .from("garage_members")
    .select("active")
    .eq("user_id", id)
    .abortSignal(AbortSignal.timeout(10000))
    .maybeSingle();
  if (error) {
    if (["PGRST205", "42P01"].includes(error.code))
      throw Error(
        "Account access is not configured yet. Please contact your administrator.",
      );
    throw Error(
      "Could not check account access. Check your connection and try again.",
    );
  }
  if (!data?.active)
    throw Error(
      "This account needs garage access. Ask your administrator to enable it.",
    );
}
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "signed_out" | "ready">(
    "checking",
  );
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false),
    [stage, setStage] = useState("Signing in..."),
    [error, setError] = useState(""),
    [capsLock, setCapsLock] = useState(false),
    [help, setHelp] = useState(false);
  const signingIn = useRef(false);
  const [installUpdate, setInstallUpdate] = useState<
    null | (() => Promise<void>)
  >(null);
  useEffect(() => {
    const onUpdate = (event: Event) => {
      const apply = (event as CustomEvent<() => Promise<void>>).detail;
      if (typeof apply === "function") setInstallUpdate(() => apply);
    };
    window.addEventListener("garage-update-available", onUpdate);
    return () =>
      window.removeEventListener("garage-update-available", onUpdate);
  }, []);
  useEffect(() => {
    let active = true;
    let checking: Promise<void> | null = null;
    const check = async () => {
      if (!supabase) {
        if (active) {
          setError(
            "Sign-in is not configured. Please contact your administrator.",
          );
          setState("signed_out");
        }
        return;
      }
      if (!navigator.onLine && localStorage.getItem(offlineIdentity)) {
        if (active) setState("ready");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (!session) {
        setState("signed_out");
        return;
      }
      if (navigator.onLine) {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(session.access_token);
        if (!active) return;
        if (authError || !user) {
          setState("signed_out");
          return;
        }
        await requireMembership(user.id, session.access_token);
        if (!active) return;
        localStorage.setItem(offlineIdentity, user.id);
      }
      setState("ready");
    };
    const safeCheck = () => {
      if (!active || signingIn.current || checking) return;
      checking = within(
        check(),
        22000,
        "Could not reconnect to your account. Please sign in again.",
      )
        .catch((e) => {
          if (active) {
            setError(
              e instanceof Error ? e.message : "Sign-in could not be checked.",
            );
            setState("signed_out");
          }
        })
        .finally(() => {
          checking = null;
        });
    };
    safeCheck();
    const listener = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem(offlineIdentity);
        if (active) setState("signed_out");
      } else if (session && !signingIn.current) setTimeout(safeCheck, 0);
    });
    window.addEventListener("online", safeCheck);
    return () => {
      active = false;
      listener?.data.subscription.unsubscribe();
      window.removeEventListener("online", safeCheck);
    };
  }, []);
  if (state === "ready") return children;
  if (state === "checking")
    return (
      <div className="loading-screen login-loading">
        <MazdaIcon size={52} />
        <LoaderCircle className="login-spinner" size={18} />
        <p>Opening your garage...</p>
      </div>
    );
  return (
    <main className="sign-in-page">
      <aside className="sign-in-visual" aria-label="Your Mazda3">
        <img
          src="/images/mazda_day.jpeg"
          alt="Your Jet Black Mica Mazda3 hatchback"
        />
        <div className="sign-in-visual-copy">
          <span>THE ART OF OWNERSHIP</span>
          <h2>
            Your Mazda.
            <br />
            Every mile, considered.
          </h2>
          <p>2019 MAZDA3 HATCHBACK · JET BLACK MICA</p>
        </div>
      </aside>
      <section className="sign-in-panel" aria-labelledby="sign-in-title">
        <div className="sign-in-card">
          <header className="sign-in-brand">
            <MazdaIcon size={54} />
            <span>
              MY GARAGE<small>YOUR MAZDA, TAKEN CARE OF.</small>
            </span>
          </header>
          <div className="sign-in-heading">
            <h1 id="sign-in-title">Welcome back.</h1>
            <p>Sign in to your personal garage.</p>
          </div>
          {installUpdate && (
            <div className="sign-in-update" role="status">
              <span>A newer version is ready.</span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void installUpdate().catch(() =>
                    setError("Close and reopen the app to finish updating."),
                  )
                }
              >
                Update app
              </button>
            </div>
          )}
          <form
            aria-busy={busy}
            onSubmit={async (event) => {
              event.preventDefault();
              if (signingIn.current) return;
              signingIn.current = true;
              setError("");
              setStage("Signing in...");
              setBusy(true);
              try {
                if (!supabase)
                  throw Error(
                    "Sign-in is not configured. Please contact your administrator.",
                  );
                if (!navigator.onLine)
                  throw Error("Connect to the internet to sign in.");
                const { data, error: authError } = await within(
                  supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                  }),
                  15000,
                  "Sign-in took too long. Check your connection and try again.",
                );
                if (authError) {
                  if (authError.status === 429)
                    throw Error(
                      "Too many sign-in attempts. Please wait a moment and try again.",
                    );
                  if (
                    !authError.status ||
                    authError.status >= 500 ||
                    /fetch|network|abort|timeout|timed?\s*out/i.test(
                      authError.message,
                    )
                  )
                    throw Error(
                      "Could not reach sign-in. Check your connection and try again.",
                    );
                  throw Error("Check your email and password, then try again.");
                }
                if (!data.user || !data.session)
                  throw Error("Sign-in did not finish. Please try again.");
                setStage("Checking access...");
                await within(
                  requireMembership(data.user.id, data.session.access_token),
                  11000,
                  "Account check took too long. Please try again.",
                );
                localStorage.setItem(offlineIdentity, data.user.id);
                setPassword("");
                setState("ready");
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not sign in. Please try again.",
                );
              } finally {
                signingIn.current = false;
                setBusy(false);
              }
            }}
          >
            <label className="sign-in-field" htmlFor="garage-email">
              <span>Email address</span>
              <input
                id="garage-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-describedby={error ? "login-error" : undefined}
              />
            </label>
            <div className="sign-in-field">
              <label htmlFor="garage-password">Password</label>
              <div className="sign-in-password">
                <input
                  id="garage-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                  onBlur={() => setCapsLock(false)}
                  placeholder="Enter your password"
                  aria-describedby={error ? "login-error" : undefined}
                />
                <button
                  type="button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {capsLock && (
                <small className="sign-in-caps" role="status">
                  Caps Lock is on
                </small>
              )}
            </div>
            {error && (
              <p className="sign-in-error" id="login-error" role="alert">
                {error}
              </p>
            )}
            <button className="sign-in-submit" type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="login-spinner" size={18} />
              ) : null}
              <span>{busy ? stage : "Sign in"}</span>
              {!busy && <ArrowRight size={18} />}
            </button>
          </form>
          <button
            type="button"
            className="sign-in-help"
            aria-expanded={help}
            aria-controls="sign-in-help-text"
            onClick={() => setHelp((v) => !v)}
          >
            Trouble signing in?
          </button>
          {help && (
            <p id="sign-in-help-text" className="sign-in-help-text">
              Use the email and password created for your account. For a
              password reset or access, contact your administrator.
            </p>
          )}
          <footer className="sign-in-note">
            <ShieldCheck size={14} />
            <span>Private access. Your garage stays with you.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

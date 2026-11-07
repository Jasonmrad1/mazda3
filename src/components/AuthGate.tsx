import { useEffect, useState, type ReactNode } from "react";
import { LockKeyhole, ArrowUpRight, LoaderCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { MazdaIcon } from "./MazdaIcon";

const offlineIdentity = "my-garage-last-authenticated-user";
async function requireMembership(id: string) {
  if (!supabase) throw Error("Sign-in is not configured.");
  const { data, error } = await supabase
    .from("garage_members")
    .select("active")
    .eq("user_id", id)
    .maybeSingle();
  if (error || !data?.active)
    throw Error(
      "This account has not been granted garage access. Contact your administrator.",
    );
}
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "signed_out" | "ready">(
    "checking",
  );
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!supabase) {
        if (active) setState("signed_out");
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
        } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) {
          setState("signed_out");
          return;
        }
        await requireMembership(user.id);
        if (!active) return;
        localStorage.setItem(offlineIdentity, user.id);
      }
      setState("ready");
    };
    const safeCheck = () => {
      void check().catch((e) => {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : "Sign-in could not be checked. Please try again.",
          );
          setState("signed_out");
        }
      });
    };
    safeCheck();
    const listener = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem(offlineIdentity);
        if (active) setState("signed_out");
      } else if (session) setTimeout(safeCheck, 0);
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
      <div className="loading-screen">
        <LoaderCircle size={22} />
        <p>Opening your private garage...</p>
      </div>
    );
  return (
    <main className="sign-in-page">
      <div className="sign-in-photograph" aria-hidden="true" />
      <section className="sign-in-card" aria-labelledby="sign-in-title">
        <div className="sign-in-brand">
          <MazdaIcon size={48} />
          <span>
            MY GARAGE<small>YOUR PRIVATE MAZDA COLLECTION</small>
          </span>
        </div>
        <span className="eyebrow">A SPACE OF YOUR OWN</span>
        <h1 id="sign-in-title">
          Welcome to
          <br />
          your garage.
        </h1>
        <p className="sign-in-intro">
          Every mile. Every detail. All in one place.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setBusy(true);
            try {
              if (!supabase) throw Error("Sign-in is not configured.");
              if (!navigator.onLine)
                throw Error("Connect to the internet for your first sign-in.");
              const { data, error: authError } =
                await supabase.auth.signInWithPassword({
                  email: email.trim(),
                  password,
                });
              if (authError)
                throw Error(
                  "Email or password was not accepted. Please try again.",
                );
              if (!data.user) throw Error("Sign-in did not return an account.");
              await requireMembership(data.user.id);
              localStorage.setItem(offlineIdentity, data.user.id);
              setPassword("");
              setState("ready");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not sign in.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={busy || !supabase}
          >
            {busy ? <LoaderCircle size={15} /> : <LockKeyhole size={15} />}{" "}
            {busy ? "Signing in..." : "Enter my garage"}
            <ArrowUpRight size={16} />
          </button>
        </form>
        <p className="sign-in-note">
          Private access. Use the account created for you.
        </p>
      </section>
    </main>
  );
}

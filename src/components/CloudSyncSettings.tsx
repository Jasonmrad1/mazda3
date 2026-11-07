import { useState } from "react";
import { Cloud, RefreshCw, ShieldCheck } from "lucide-react";
import { useGarage } from "../lib/store";

const labels = {
  disabled: "Not configured in this build",
  signed_out: "On this device · sign in to enable backup",
  offline: "Offline · saved here, sync will retry when connected",
  syncing: "Syncing your garage…",
  synced: "Cloud backup is up to date",
  conflict: "This device and cloud have different changes",
  error: "Cloud sync needs attention",
} as const;

export function CloudSyncSettings() {
  const {
    cloudStatus, cloudEmail, cloudError, signIn, signOut, syncNow,
    useCloudCopy, uploadDeviceCopy,
  } = useGarage();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, success?: string) => {
    setBusy(true);
    setNotice("");
    try { await fn(); if (success) setNotice(success); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not sync."); }
    finally { setBusy(false); }
  };
  return (
    <section className="cloud-sync-settings" aria-label="Cloud backup">
      <div className="cloud-sync-heading">
        <div className="cloud-sync-mark"><Cloud size={17} /></div>
        <div>
          <h3>Private cloud backup</h3>
          <p>{labels[cloudStatus]}</p>
        </div>
        {cloudStatus === "synced" && <ShieldCheck size={17} aria-label="Synced" />}
      </div>
      {!cloudEmail ? (
        <form className="cloud-sync-form" onSubmit={(event) => {
          event.preventDefault();
          void run(async () => { await signIn(email); setNotice("Check your email for the secure sign-in link."); });
        }}>
          <label className="field">
            <span>Email for a secure sign-in link</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={cloudStatus === "disabled"} />
          </label>
          <button className="button secondary" type="submit" disabled={busy || cloudStatus === "disabled"}>
            Send sign-in link
          </button>
        </form>
      ) : (
        <div className="cloud-sync-account">
          <p>Signed in as <strong>{cloudEmail}</strong></p>
          {cloudStatus === "conflict" ? (
            <div className="cloud-sync-conflict">
              <p>Choose which saved copy to keep. The other copy won’t be overwritten silently.</p>
              <button className="button secondary" disabled={busy} onClick={() => void run(useCloudCopy, "Cloud copy restored to this device.")}>Use cloud copy</button>
              <button className="button secondary" disabled={busy} onClick={() => void run(uploadDeviceCopy, "This device is now backed up.")}>Keep this device</button>
            </div>
          ) : (
            <div className="cloud-sync-actions">
              <button className="button secondary" disabled={busy || cloudStatus === "offline"} onClick={() => void run(syncNow, "Garage backup is up to date.")}>
                <RefreshCw size={14} /> Sync now
              </button>
              <button className="text-button" disabled={busy} onClick={() => void run(signOut, "Signed out. Your local garage remains on this device.")}>Sign out</button>
            </div>
          )}
        </div>
      )}
      {(notice || cloudError) && <p className="cloud-sync-message" role="status">{notice || cloudError}</p>}
      <p className="cloud-sync-footnote">Edits save on this device first. When online, signed-in changes sync automatically. Your garage is private to your account.</p>
    </section>
  );
}

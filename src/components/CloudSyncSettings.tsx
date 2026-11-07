import { useState } from "react";
import { Cloud, RefreshCw, ShieldCheck } from "lucide-react";
import { useGarage } from "../lib/store";
const labels = {
  disabled: "Cloud sync is not configured",
  signed_out: "Saved on this device",
  offline: "Offline · changes stay pending",
  syncing: "Syncing your records...",
  synced: "All records synced",
  conflict: "Some records changed on another device",
  error: "Sync needs attention",
  pending: "Changes waiting to sync",
} as const;
export function CloudSyncSettings() {
  const {
    cloudStatus,
    cloudEmail,
    cloudError,
    signOut,
    syncNow,
    useCloudCopy,
    uploadDeviceCopy,
    pendingCount,
  } = useGarage();
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, success: string) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      setNotice(success);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not sync.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="cloud-sync-settings" aria-label="Account and sync">
      <div className="cloud-sync-heading">
        <div className="cloud-sync-mark">
          <Cloud size={17} />
        </div>
        <div>
          <h3>Your private garage</h3>
          <p>{labels[cloudStatus]}</p>
          <p aria-live="polite">
            {pendingCount} pending {pendingCount === 1 ? "record" : "records"}
          </p>
        </div>
        {cloudStatus === "synced" && (
          <ShieldCheck size={17} aria-label="Synced" />
        )}
      </div>
      <div className="cloud-sync-account">
        <p>
          Signed in as <strong>{cloudEmail || "your private account"}</strong>
        </p>
        {cloudStatus === "conflict" ? (
          <div className="cloud-sync-conflict">
            <p>
              Choose which values to keep for the conflicting records. Other
              records are unaffected.
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void run(useCloudCopy, "Cloud values applied.")}
            >
              Use cloud values
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void run(uploadDeviceCopy, "Local values queued.")}
            >
              Keep local values
            </button>
          </div>
        ) : (
          <div className="cloud-sync-actions">
            <button
              className="button secondary"
              disabled={busy || cloudStatus === "offline"}
              onClick={() => void run(syncNow, "Sync check complete.")}
            >
              <RefreshCw size={14} />
              Sync now
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void run(signOut, "Signed out.")}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      {(notice || cloudError) && (
        <p className="cloud-sync-message" role="status">
          {notice || cloudError}
        </p>
      )}
      <p className="cloud-sync-footnote">
        Records save on this device first and sync automatically when connected.
        Account access is managed by your administrator.
      </p>
    </section>
  );
}

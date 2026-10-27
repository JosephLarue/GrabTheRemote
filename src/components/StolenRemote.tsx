"use client";

import { useState } from "react";
import { errorText } from "@/i18n";
import { post } from "@/lib/api";
import { formatClock, useLive, useServerNow } from "@/lib/live";

/** The stolen remote: a countdown for everyone, the veto button for whoever holds it. */
export function StolenRemote() {
  const { room, t, state, me, refreshMe } = useLive();
  const now = useServerNow(500);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const endsAt = state?.steal?.endsAt ?? 0;
  const left = endsAt - now;
  if (left <= 0)
    return msg ? (
      <p className="sticker bg-[var(--mint)] text-[var(--ink)]">{msg}</p>
    ) : null;
  const mine = me.remote;

  const veto = async () => {
    setBusy(true);
    const res = await post<{ vetoed: boolean }>("/api/veto", { room });
    setMsg(
      res.ok ? t.steal.vetoed : errorText(t, res.err, { room, kind: "veto" }),
    );
    setTimeout(() => setMsg(null), 5000);
    setBusy(false);
    refreshMe();
  };

  // Padding, not margin: a margin would collapse into the TV's and the antennas would poke through.
  return (
    <div className="pb-6">
      <div
        role="status"
        className={`panel flex flex-wrap items-center justify-between gap-3 p-4 ${mine ? "steal-mine" : ""}`}
      >
        <div className="min-w-0">
          <p className="font-display text-2xl sm:text-3xl">
            {mine ? t.steal.you : t.steal.someone}
          </p>
          <p className="text-sm font-bold">
            {mine ? t.steal.youHint : t.steal.someoneHint(formatClock(left))}
          </p>
          {msg && <p className="mt-1 text-sm font-extrabold">{msg}</p>}
        </div>
        {mine && (
          <button
            type="button"
            className="btn font-display shrink-0 bg-[var(--skip)] px-6 py-3 text-2xl text-[var(--ink)] uppercase"
            disabled={busy || state?.nowPlaying?.state !== "playing"}
            onClick={veto}
          >
            {t.steal.veto}
            <span className="font-sans text-sm font-extrabold tabular-nums">
              {formatClock(left)}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

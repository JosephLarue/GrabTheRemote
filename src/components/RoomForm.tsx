'use client';

import { useState } from 'react';
import {
  PRIVATE_LANGS,
  PRIVATE_LOCALES,
  PRIVATE_MAX_DURATIONS_MIN,
  PRIVATE_VOTE_COOLDOWNS_S,
} from '@/config/app';
import { THEMES_ENABLED } from '@/config/app';
import { CONSTRAINTS } from '@/config/constraints';
import { DECORS, ROOM_INFO } from '@/config/rooms';
import type { Dict } from '@/i18n';
import type { RoomInput } from '@/lib/private-room';

const LOCALE_NAMES: Record<string, string> = { en: 'English', fr: 'Français', es: 'Español', it: 'Italiano' };

/** A private room's settings, for creating it or for its streamer to edit later. */
export function RoomForm({
  t,
  initial,
  editing,
  busy,
  submitLabel,
  onSubmit,
}: {
  t: Dict;
  initial: RoomInput;
  editing?: boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: RoomInput) => void;
}) {
  const [v, setV] = useState(initial);
  const p = t.private;
  const rules = (patch: Partial<RoomInput['rules']>) => setV((s) => ({ ...s, rules: { ...s.rules, ...patch } }));
  const fixedId = v.themes.mode === 'fixed' ? v.themes.id : CONSTRAINTS[0].id;

  return (
    // Laid out by its own width (container queries): wide on /private, a single column inside the remote.
    <form
      className="@container flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <Field label={p.name} htmlFor="room-name">
        <input
          id="room-name"
          required
          maxLength={40}
          value={v.name}
          placeholder={p.namePlaceholder}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          className="field"
        />
      </Field>

      <Field label={p.password} htmlFor="room-password" hint={editing ? p.newPasswordHint : p.passwordHint}>
        <input
          id="room-password"
          value={v.password ?? ''}
          maxLength={20}
          pattern="[A-Za-z0-9]{4,20}"
          autoComplete="off"
          onChange={(e) => setV({ ...v, password: e.target.value })}
          className="field font-display tracking-widest uppercase"
        />
      </Field>

      <div className="grid gap-4 @md:grid-cols-2">
        <Field label={p.locale} htmlFor="room-locale">
          <select id="room-locale" value={v.locale} onChange={(e) => setV({ ...v, locale: e.target.value })} className="field">
            {PRIVATE_LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l] ?? l}
              </option>
            ))}
          </select>
        </Field>
        <Field label={p.lang} htmlFor="room-lang">
          <select
            id="room-lang"
            value={v.rules.lang ?? ''}
            onChange={(e) => rules({ lang: e.target.value || null })}
            className="field"
          >
            <option value="">{p.anyLang}</option>
            {PRIVATE_LANGS.map((l) => (
              <option key={l} value={l}>
                {t.languages[l] ?? l}
              </option>
            ))}
          </select>
        </Field>
        <Field label={p.maxDuration} htmlFor="room-max">
          <select
            id="room-max"
            value={v.rules.maxDurationMin}
            onChange={(e) => rules({ maxDurationMin: Number(e.target.value) })}
            className="field"
          >
            {PRIVATE_MAX_DURATIONS_MIN.map((m) => (
              <option key={m} value={m}>
                {t.duration(m * 60)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={p.voteCooldown} htmlFor="room-cooldown">
          <select
            id="room-cooldown"
            value={v.rules.voteCooldownS}
            onChange={(e) => rules({ voteCooldownS: Number(e.target.value) })}
            className="field"
          >
            {PRIVATE_VOTE_COOLDOWNS_S.map((s) => (
              <option key={s} value={s}>
                {t.duration(s)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-6">
        <Toggle label={p.skip} on={v.rules.skip} t={t} onChange={(skip) => rules({ skip })} />
        <Toggle label={p.report} on={v.rules.report} t={t} onChange={(report) => rules({ report })} />
      </div>

      {THEMES_ENABLED && (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-extrabold">{p.themes}</legend>
        <Radio name="themes" checked={v.themes.mode === 'roulette'} onChange={() => setV({ ...v, themes: { mode: 'roulette' } })}>
          🎲 {p.roulette}
        </Radio>
        <Radio name="themes" checked={v.themes.mode === 'none'} onChange={() => setV({ ...v, themes: { mode: 'none' } })}>
          🙌 {p.noTheme}
        </Radio>
        <div className="flex flex-wrap items-center gap-2">
          <Radio
            name="themes"
            checked={v.themes.mode === 'fixed'}
            onChange={() => setV({ ...v, themes: { mode: 'fixed', id: fixedId } })}
          >
            📌 {p.fixedTheme}
          </Radio>
          <select
            aria-label={p.fixedTheme}
            value={fixedId}
            onChange={(e) => setV({ ...v, themes: { mode: 'fixed', id: e.target.value } })}
            className="field w-auto py-1"
          >
            {CONSTRAINTS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {t.themes[c.id] ?? c.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-extrabold">{p.decor}</legend>
        <div className="flex flex-wrap gap-2">
          {DECORS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={v.decor === d}
              title={ROOM_INFO[d].name}
              onClick={() => setV({ ...v, decor: d })}
              className={`grid h-14 w-14 place-items-center rounded-2xl border-[3px] border-[var(--edge)] text-2xl ${v.decor === d ? 'shadow-[var(--pop)] ring-4 ring-[var(--glow)]' : 'opacity-70 hover:opacity-100'}`}
              style={{ background: `linear-gradient(135deg, ${ROOM_INFO[d].wall} 50%, ${ROOM_INFO[d].tv} 50%)` }}
            >
              {ROOM_INFO[d].emoji}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn font-display self-start bg-[var(--skip)] px-6 py-3 text-xl text-[var(--ink)]" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-extrabold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs font-semibold opacity-75">{hint}</p>}
    </div>
  );
}

function Toggle({ label, on, t, onChange }: { label: string; on: boolean; t: Dict; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 font-extrabold">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--skip)]" />
      {label}
      <span className="text-xs font-bold opacity-70">{on ? t.private.on : t.private.off}</span>
    </label>
  );
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 font-bold">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-5 w-5 accent-[var(--skip)]" />
      {children}
    </label>
  );
}

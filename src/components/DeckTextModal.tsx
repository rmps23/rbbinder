"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Select } from "./Select";
import type { DeckFamily } from "@/lib/deckVersions";

// Shared by the deck list (import into a new deck) and the builder (import
// into / export from the open deck).
export function DeckTextModal({
  mode,
  initialText = "",
  fileName = "deck",
  families = [],
  guess,
  onClose,
  onImport,
}: {
  mode: "import" | "export";
  initialText?: string;
  fileName?: string;
  onClose: () => void;
  /** decks the list can be saved as a new version of; just one = no picker */
  families?: DeckFamily[];
  /** the deck (id) a list most looks like */
  guess?: (text: string) => string | undefined;
  /** `versionOf`: the deck to add a version to. Returns a message to show (e.g. unknown cards), or null to close */
  onImport?: (text: string, versionOf: string | null) => string | null | Promise<string | null>;
}) {
  const [text, setText] = useState(initialText);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asVersion, setAsVersion] = useState(false);
  const [picked, setPicked] = useState("");

  // Until you pick a deck, the one the pasted list looks like.
  const familyOf = (id?: string) => families.find((f) => f.versions.some((d) => d.id === id));
  const family = !asVersion ? undefined : families.length === 1 ? families[0] : (families.find((f) => f.id === picked) ?? familyOf(guess?.(text)));

  async function run() {
    setBusy(true);
    const msg = (await onImport?.(text, family?.latest.id ?? null)) ?? null;
    setBusy(false);
    if (msg) setMessage(msg);
    else onClose();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked - the text is selectable in the box
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/[^\w\-]+/g, "_") || "deck"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ghost =
    "inline-flex h-11 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold text-t1 transition hover:border-line2 hover:bg-panel2 disabled:cursor-not-allowed disabled:opacity-40";
  const primary = "btn-3d h-11 rounded-lg px-6 font-display text-xs font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <Modal
      title={mode === "import" ? "Import deck" : "Export deck"}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {mode === "import" ? (
            <button
              type="button"
              disabled={!text.trim() || busy || (asVersion && !family)}
              onClick={run}
              className={primary}
            >
              {busy ? "One moment…" : family ? `Import as v${family.latest.version + 1}` : "Import"}
            </button>
          ) : (
            <>
              <button type="button" onClick={copy} className={primary}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <button type="button" onClick={download} className={ghost}>
                Download .txt
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className={`${ghost} text-t2`}>
            Close
          </button>
        </div>
      }
    >
      <p className="text-sm text-t2">
        {mode === "import"
          ? "Paste a deck list (Legend / Champion / MainDeck / Battlefields / Runes / Sideboard, one “3 Card name” per line)."
          : "Copy this list or download it as a .txt file."}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={mode === "export"}
        spellCheck={false}
        aria-label={mode === "import" ? "Deck list to import" : "Deck list"}
        placeholder={"Legend:\n1 …\n\nMainDeck:\n3 …"}
        className="h-72 w-full resize-none rounded-lg border border-line bg-ink p-3 font-mono text-xs leading-relaxed text-t1"
      />
      {mode === "import" && families.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <label className="flex min-h-6 cursor-pointer items-center gap-3 text-sm font-semibold text-t1">
            <input type="checkbox" checked={asVersion} onChange={(e) => setAsVersion(e.target.checked)} className="h-5 w-5 shrink-0 accent-brand-gold" />
            {families.length === 1 && !guess ? "New version of this deck" : "New version of a deck"}
          </label>
          {asVersion && families.length > 1 && (
            <Select
              value={family?.id ?? ""}
              onChange={setPicked}
              ariaLabel="Deck this is a new version of"
              placeholder="Which deck?"
              className="h-11 text-sm"
              options={families.map((f) => ({ value: f.id, label: f.name, hint: `v${f.latest.version}` }))}
            />
          )}
          {asVersion && (
            <p className="text-xs leading-snug text-t3">
              {family
                ? `Saved as ${family.name} v${family.latest.version + 1}. Earlier versions stay as they are, and the match history counts each one apart.`
                : "Pick the deck this list is a new version of."}
            </p>
          )}
        </div>
      )}
      {message && <p className="whitespace-pre-line rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">⚠ {message}</p>}
    </Modal>
  );
}

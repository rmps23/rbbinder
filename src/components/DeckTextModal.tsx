"use client";

import { useState } from "react";
import { BottomSheet } from "./BottomSheet";

// Shared by the deck list (import into a new deck) and the builder (import
// into / export from the open deck).
export function DeckTextModal({
  mode,
  initialText = "",
  fileName = "deck",
  onClose,
  onImport,
}: {
  mode: "import" | "export";
  initialText?: string;
  fileName?: string;
  onClose: () => void;
  onImport?: (text: string) => string | null; // returns a message to show (e.g. unknown cards), or null to close
}) {
  const [text, setText] = useState(initialText);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const button = "rounded-md px-5 py-2 font-display text-xs font-semibold uppercase tracking-wide";

  return (
    <BottomSheet title={mode === "import" ? "Import deck" : "Export deck"} onClose={onClose}>
      <p className="mb-2 text-xs text-white/50">
        {mode === "import"
          ? "Paste a deck list (Legend / Champion / MainDeck / Battlefields / Runes / Sideboard, one “3 Card name” per line)."
          : "Copy this list or download it as a .txt file."}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={mode === "export"}
        autoFocus
        spellCheck={false}
        placeholder={"Legend:\n1 …\n\nMainDeck:\n3 …"}
        className="h-64 w-full resize-none rounded-lg border border-white/10 bg-ink p-3 font-mono text-xs text-white outline-none focus:border-brand-gold"
      />
      {message && <p className="mt-2 whitespace-pre-line text-xs text-brand-goldSoft">{message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "import" ? (
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => {
              const msg = onImport?.(text) ?? null;
              if (msg) setMessage(msg);
              else onClose();
            }}
            className={`${button} bg-brand-gold text-ink hover:bg-brand-goldSoft disabled:opacity-50`}
          >
            Import
          </button>
        ) : (
          <>
            <button type="button" onClick={copy} className={`${button} bg-brand-gold text-ink hover:bg-brand-goldSoft`}>
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={download} className={`${button} border border-brand-gold text-brand-gold`}>
              Download .txt
            </button>
          </>
        )}
        <button type="button" onClick={onClose} className={`${button} border border-white/20 text-white/70`}>
          Close
        </button>
      </div>
    </BottomSheet>
  );
}

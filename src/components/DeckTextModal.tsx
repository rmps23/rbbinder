"use client";

import { useState } from "react";
import { Modal } from "./Modal";

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
              disabled={!text.trim()}
              onClick={() => {
                const msg = onImport?.(text) ?? null;
                if (msg) setMessage(msg);
                else onClose();
              }}
              className={primary}
            >
              Import
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
      {message && <p className="whitespace-pre-line rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">⚠ {message}</p>}
    </Modal>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { labels } from "@/lib/labels";

/**
 * Share a piece of the screen (e.g. a receipt) as a picture through the phone's
 * own share sheet — Viber, Messenger, Line, Telegram, whatever is installed.
 *
 * The receipt page itself is behind a login, so a link would be useless to the
 * buyer; a PNG works everywhere. The picture is prepared in the background as
 * soon as the page is up, because phones only allow sharing straight after a
 * tap — making the image first would use that moment up.
 *
 * Where the browser can't share files (most desktops), it saves the PNG instead.
 */
export function ShareImageButton({
  targetRef,
  fileName,
  title,
  className,
}: {
  targetRef: RefObject<HTMLElement | null>;
  fileName: string;
  title: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const cached = useRef<File | null>(null);

  const render = useCallback(async (): Promise<File | null> => {
    const node = targetRef.current;
    if (!node) return null;
    const { toBlob } = await import("html-to-image");
    const opts = { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true };
    // Safari often leaves images out of the first pass, so render twice there.
    let blob = await toBlob(node, opts);
    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) blob = await toBlob(node, opts);
    if (!blob) return null;
    return new File([blob], fileName, { type: "image/png" });
  }, [targetRef, fileName]);

  // Prepare ahead of the tap. A change to the receipt (e.g. a payment added)
  // re-mounts this with a new key, so the picture is never stale.
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      render()
        .then((f) => {
          if (live) cached.current = f;
        })
        .catch(() => {
          /* made on demand instead */
        });
    }, 600);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [render]);

  async function share() {
    setNote(null);
    setBusy(true);
    try {
      const file = cached.current ?? (await render());
      if (!file) throw new Error("no image");
      cached.current = file;
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
        } catch (e) {
          const name = (e as Error)?.name;
          if (name === "AbortError") return; // the user closed the share sheet
          // The picture took too long and the tap "expired": it is ready now.
          if (name === "NotAllowedError") return setNote(labels.share.tapAgain);
          throw e;
        }
      } else {
        // No file sharing here: save the picture so it can be sent by hand.
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setNote(labels.share.saved);
      }
    } catch {
      setNote(labels.share.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className={
          className ??
          "rounded-2xl border-2 border-sky-600 bg-white py-4 text-lg font-bold text-sky-700 shadow-sm active:scale-[0.98] disabled:opacity-60"
        }
      >
        📤 {busy ? labels.share.preparing : labels.share.button}
      </button>
      {note && <p className="text-center text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * Browser TTS for staff voice confirmation. Free, on-device, works offline.
 *
 * Burmese support varies by device. Most modern Androids have a Myanmar voice;
 * iOS sometimes does not. We don't fall back to anything; if the device can't
 * pronounce Burmese, it simply stays silent. The visual confirmation on the UI
 * is the source of truth.
 */
export function speak(text: string, lang = "my-MM"): void {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    // Voice synthesis is best-effort. Never let it block the UI.
  }
}

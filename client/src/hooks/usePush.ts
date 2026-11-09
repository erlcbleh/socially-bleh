import { useCallback, useEffect, useState } from "react";
import { pushSupported, pushPermission, isPushEnabled, enablePush, disablePush } from "../lib/push";

export function usePush() {
  const [supported] = useState(pushSupported);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!supported) return;
    setDenied(pushPermission() === "denied");
    isPushEnabled()
      .then(setEnabled)
      .catch(() => {});
  }, [supported]);

  const toggle = useCallback(async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        const ok = await enablePush();
        setEnabled(ok);
        setDenied(pushPermission() === "denied");
      }
    } finally {
      setBusy(false);
    }
  }, [enabled]);

  return { supported, enabled, busy, denied, toggle };
}

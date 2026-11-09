import { useEffect, useState } from "react";

export function useOptimisticToggle(serverValue: boolean, mutate: (value: boolean) => Promise<unknown>) {
  const [value, setValue] = useState(serverValue);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setValue(serverValue);
  }, [serverValue]);

  const toggle = async (next: boolean) => {
    setValue(next);
    setPending(true);
    try {
      await mutate(next);
    } catch {
      setValue(serverValue);
    } finally {
      setPending(false);
    }
  };

  return { value, toggle, pending };
}

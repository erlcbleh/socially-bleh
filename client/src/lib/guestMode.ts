const GUEST_MODE_KEY = "socially_guest_mode";

export function isGuestMode(): boolean {
  try {
    return localStorage.getItem(GUEST_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableGuestMode() {
  try {
    localStorage.setItem(GUEST_MODE_KEY, "1");
  } catch {
    return;
  }
}

export function disableGuestMode() {
  try {
    localStorage.removeItem(GUEST_MODE_KEY);
  } catch {
    return;
  }
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "../../lib/queryStore";
import { LuChevronRight, LuMoon, LuSun } from "react-icons/lu";
import { useTheme } from "../../lib/themeContext";
import { useAuth } from "../../lib/authContext";
import { api } from "../../lib/api";
import { Modal } from "../../components/shared/Modal";
import { usePush } from "../../hooks/usePush";

export default function MiscellaneousSettings() {
  const { theme, setTheme } = useTheme();
  const push = usePush();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");

  const deactivate = useMutation({
    mutationFn: () => api.post("/users/me/deactivate"),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login?deactivated=1");
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.delete("/users/me", { username: confirmUsername }),
    onSuccess: () => {
      queryClient.clear();
      navigate("/login?deleted=1");
    },
  });

  return (
    <div className="max-w-lg space-y-8">
      <div className="space-y-3">
        <h3 className="font-medium">Theme</h3>
        <p className="text-sm text-neutral-500">Choose how Socially looks on this device.</p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTheme("light")}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
              theme === "light" ? "border-brand ring-1 ring-brand" : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <LuSun className="h-6 w-6" />
            <span className="text-sm font-medium">Light</span>
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
              theme === "dark" ? "border-brand ring-1 ring-brand" : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <LuMoon className="h-6 w-6" />
            <span className="text-sm font-medium">Dark</span>
          </button>
        </div>
      </div>

      {push.supported && (
        <div className="space-y-3">
          <h3 className="font-medium">Notifications</h3>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="min-w-0">
              <h4 className="text-sm font-medium">Push notifications</h4>
              <p className="mt-0.5 text-xs text-neutral-500">
                {push.denied
                  ? "Blocked in your browser settings. Allow notifications for this site to turn them on."
                  : "Get notified about mentions and replies on this device."}
              </p>
            </div>
            <button
              onClick={push.toggle}
              disabled={push.busy || push.denied}
              role="switch"
              aria-checked={push.enabled}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
                push.enabled ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700"
              }`}
            >
              <span
                className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  push.enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-medium">Legal</h3>
        <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <Link
            to="/privacy"
            className="flex items-center justify-between gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <span className="text-sm font-medium">Privacy Policy</span>
            <LuChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
          </Link>
          <div className="border-t border-neutral-200 dark:border-neutral-800" />
          <Link
            to="/terms"
            className="flex items-center justify-between gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <span className="text-sm font-medium">Terms of Service</span>
            <LuChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
          </Link>
          <div className="border-t border-neutral-200 dark:border-neutral-800" />
          <Link
            to="/copyright"
            className="flex items-center justify-between gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <span className="text-sm font-medium">Copyright / DMCA request</span>
            <LuChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium text-red-600 dark:text-red-400">Danger zone</h3>

        <div className="overflow-hidden rounded-xl border border-red-200 dark:border-red-900">
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <h4 className="text-sm font-medium">Deactivate account</h4>
              <p className="mt-0.5 text-xs text-neutral-500">
                Hides your profile and posts. Reactivates next time you sign in with Discord.
              </p>
            </div>
            <button
              onClick={() => setConfirmingDeactivate(true)}
              className="shrink-0 rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              Deactivate
            </button>
          </div>
          <div className="border-t border-red-200 dark:border-red-900" />
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <h4 className="text-sm font-medium">Delete account</h4>
              <p className="mt-0.5 text-xs text-neutral-500">
                Permanently erases your account, posts, and messages. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => {
                setConfirmUsername("");
                setConfirmingDelete(true);
              }}
              className="shrink-0 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={confirmingDeactivate}
        onClose={() => setConfirmingDeactivate(false)}
        title="Deactivate account?"
        tone="danger"
      >
        <p className="text-sm text-neutral-500">
          Your profile and posts will be hidden from everyone. Logging in again with Discord will reactivate your
          account.
        </p>
        {deactivate.isError && <p className="mt-2 text-sm text-red-500">{(deactivate.error as Error).message}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => deactivate.mutate()}
            disabled={deactivate.isPending}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {deactivate.isPending ? "Deactivating…" : "Confirm deactivation"}
          </button>
          <button
            onClick={() => setConfirmingDeactivate(false)}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete your account?"
        tone="danger"
      >
        <p className="text-sm text-neutral-500">
          This permanently deletes your profile, posts, messages, and everything else tied to your account. There is
          no way to undo this or get your data back.
        </p>
        <label className="mt-4 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Type <span className="font-semibold">{user?.username}</span> to confirm
        </label>
        <input
          value={confirmUsername}
          onChange={(e) => setConfirmUsername(e.target.value)}
          placeholder={user?.username}
          autoCapitalize="off"
          autoCorrect="off"
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-red-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        {deleteAccount.isError && (
          <p className="mt-2 text-sm text-red-500">{(deleteAccount.error as Error).message}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => deleteAccount.mutate()}
            disabled={deleteAccount.isPending || confirmUsername !== user?.username}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {deleteAccount.isPending ? "Deleting…" : "Permanently delete account"}
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}

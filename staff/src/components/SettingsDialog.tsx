import { useState } from "react";
import { Modal } from "@socially/shared/components/Modal";
import { setUiMode, useUiMode } from "../lib/uiMode";
import { useAuth } from "../lib/authContext";
import type { StaffContext } from "../types";

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[13px] text-neutral-400">{label}</span>
      <span className="font-mono text-[13px] text-neutral-100">{value}</span>
    </div>
  );
}

export function SettingsDialog({
  open,
  onClose,
  staff,
}: {
  open: boolean;
  onClose: () => void;
  staff: StaffContext;
}) {
  const mode = useUiMode();
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const advanced = mode === "advanced";
  const communityCount = Object.keys(staff.communityRoles).length;

  return (
    <Modal open onClose={onClose} title="Settings" size="sm">
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="mb-1 text-[13px] font-medium text-white">Workspace mode</h3>
          <p className="text-[13px] leading-relaxed text-neutral-400">
            {advanced
              ? "Advanced mode is on: the full workspace with every panel, free docking, saved layouts and shared presets."
              : "Simple mode is the classic staff panel - one row of tabs, one screen at a time, nothing to arrange."}
          </p>

          {!advanced && !confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 rounded-full border border-white/20 px-3.5 py-2 text-[13px] text-neutral-200 transition-colors hover:border-white/40 hover:bg-white/[0.06] hover:text-white"
            >
              Turn on advanced mode
            </button>
          ) : null}

          {!advanced && confirming ? (
            <div className="mt-3 rounded-xl border border-white/15 bg-white/[0.04] p-3">
              <p className="text-[13px] leading-relaxed text-neutral-200">
                Advanced mode unlocks everything: overview, security, AI moderation, staff sessions, notes,
                saved searches, the command palette, free panel docking and layout editing.
              </p>
              <p className="mt-1.5 text-[13px] text-neutral-400">
                It is easy to end up with a workspace you did not intend. You can switch back at any time,
                and Reset layout restores the default.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-full border border-white/15 px-3.5 py-2 text-[13px] text-neutral-200 transition-colors hover:border-white/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUiMode("advanced");
                    setConfirming(false);
                  }}
                  className="rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-neutral-200"
                >
                  Enable advanced mode
                </button>
              </div>
            </div>
          ) : null}

          {advanced ? (
            <button
              type="button"
              onClick={() => setUiMode("simple")}
              className="mt-3 rounded-full border border-white/20 px-3.5 py-2 text-[13px] text-neutral-200 transition-colors hover:border-white/40 hover:bg-white/[0.06] hover:text-white"
            >
              Back to simple mode
            </button>
          ) : null}
        </section>

        <section className="border-t border-white/[0.09] pt-4">
          <h3 className="mb-1.5 text-[13px] font-medium text-white">Your access</h3>
          <Line label="Signed in as" value={`@${user?.username ?? "-"}`} />
          <Line label="Role" value={user?.role ?? "-"} />
          <Line
            label="Scope"
            value={
              staff.isGlobalStaff
                ? `global ${staff.role}`
                : `${communityCount} ${communityCount === 1 ? "community" : "communities"}`
            }
          />
          {staff.isGlobalStaff && !staff.canViewPrivateData ? (
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
              Network bans, security flags, staff sessions and linked Discord accounts are hidden from the
              staff rank. Ask an admin or developer if you need them for a case.
            </p>
          ) : null}
          {staff.assignableRoles.length > 0 ? (
            <Line label="Can assign" value={staff.assignableRoles.join(", ")} />
          ) : null}
        </section>

        <div className="flex justify-end border-t border-white/[0.09] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-neutral-200"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "../lib/queryStore";
import { LuArrowLeft, LuCheck } from "react-icons/lu";
import { api, apiOrigin } from "../lib/api";
import { Modal } from "../components/shared/Modal";

const inputClass =
  "w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900";
const labelClass = "mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300";

const POSITIONS = [
  {
    title: "Support",
    description: "Help members with account issues, moderation questions, and everyday platform support.",
  },
  {
    title: "High Rank",
    description: "Lead and oversee our Operations, Community Management, and Support teams.",
    closed: true,
  },
];

const DEPARTMENTS = ["Operations", "Community Management", "Support Management"];

const POSITION_QUESTIONS: Record<string, string[]> = {
  Support: [
    "How would you handle a general question in a support ticket?",
    "How would you handle a user spamming in general chat?",
    "How would you handle a user reporting harassment from another member?",
    "How would you de-escalate an argument between two users that's getting heated?",
  ],
  "High Rank": [
    "How would you handle a disagreement between two staff members about how to handle a case?",
    "A team you oversee is falling behind on response times, how do you address it?",
    "How would you handle a staff member who keeps breaking guidelines despite warnings?",
    "How would you prioritize conflicting requests coming from Operations, Community Management, and Support?",
  ],
};

function useApplicationDiscordIdentity() {
  return useQuery({
    queryKey: ["application-discord-identity"],
    queryFn: () => api.get<{ connected: boolean; discordUsername?: string }>("/staff-applications/discord/me"),
  });
}

function ApplyModal({ position, discordUsername, onClose }: { position: string; discordUsername: string; onClose: () => void }) {
  const scenarioQuestions = POSITION_QUESTIONS[position] ?? [];
  const requiresDepartment = position === "High Rank";

  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [motivation, setMotivation] = useState("");
  const [experience, setExperience] = useState("");
  const [scenarioAnswers, setScenarioAnswers] = useState(() => scenarioQuestions.map(() => ""));
  const [tosAgreed, setTosAgreed] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      api.post("/staff-applications", {
        position,
        department: requiresDepartment ? department : undefined,
        motivation,
        experience,
        scenarioResponses: scenarioQuestions.map((question, i) => ({ question, answer: scenarioAnswers[i] })),
        tosAgreed,
      }),
  });

  const canSubmit =
    (!requiresDepartment || department) && motivation.trim() && scenarioAnswers.every((a) => a.trim()) && tosAgreed;

  return (
    <Modal open onClose={onClose} title={`${position} Application`}>
      {submit.isSuccess ? (
        <div className="py-6 text-center">
          <p className="text-lg font-medium">Application submitted</p>
          <p className="mt-2 text-sm text-neutral-500">
            Thanks for applying, our team will review your application and reach out on Discord if you're a good fit.
          </p>
          <button onClick={onClose} className="mt-6 rounded-full bg-brand px-5 py-2 font-medium text-white">
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {submit.isError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
              {(submit.error as Error).message}
            </p>
          )}

          <p className="text-sm text-neutral-500">
            Applying as <span className="font-medium text-neutral-700 dark:text-neutral-300">@{discordUsername}</span>
          </p>

          {requiresDepartment && (
            <div>
              <label className={labelClass}>Department</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>Why do you want to join the team?</label>
            <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={4} maxLength={2000} className={inputClass} />
          </div>

          {scenarioQuestions.map((question, i) => (
            <div key={question}>
              <label className={labelClass}>{question}</label>
              <textarea
                value={scenarioAnswers[i]}
                onChange={(e) =>
                  setScenarioAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
                }
                rows={3}
                maxLength={2000}
                className={inputClass}
              />
            </div>
          ))}

          <div>
            <label className={labelClass}>Relevant experience (optional)</label>
            <textarea value={experience} onChange={(e) => setExperience(e.target.value)} rows={4} maxLength={2000} className={inputClass} />
          </div>

          <button
            type="button"
            onClick={() => setTosAgreed((a) => !a)}
            aria-pressed={tosAgreed}
            className="flex w-full items-center gap-3 text-left"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                tosAgreed ? "border-brand bg-brand" : "border-neutral-400 dark:border-neutral-600"
              }`}
            >
              {tosAgreed && <LuCheck className="h-3.5 w-3.5 text-white" />}
            </span>
            <span className="text-sm">
              I have read and agree to Socially's{" "}
              <Link
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="underline"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </button>

          <button
            onClick={() => submit.mutate()}
            disabled={!canSubmit || submit.isPending}
            className="rounded-full bg-brand px-5 py-2 font-medium text-white disabled:opacity-40"
          >
            {submit.isPending ? "Submitting…" : "Submit application"}
          </button>
        </div>
      )}
    </Modal>
  );
}

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: identity } = useApplicationDiscordIdentity();
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [closedNotice, setClosedNotice] = useState(false);

  useEffect(() => {
    const pendingPosition = searchParams.get("position");
    if (searchParams.get("discord_connected") && pendingPosition && identity?.connected) {
      setApplyingTo(pendingPosition);
      setSearchParams({}, { replace: true });
    }
  }, [identity?.connected, searchParams]);

  const startApply = (position: string) => {
    if (POSITIONS.find((p) => p.title === position)?.closed) {
      setClosedNotice(true);
      return;
    }
    if (identity?.connected) {
      setApplyingTo(position);
    } else {
      window.location.href = `${apiOrigin}/api/staff-applications/discord/redirect?position=${encodeURIComponent(position)}`;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="sticky top-0 z-10 flex items-center gap-4 bg-white/80 p-3 backdrop-blur dark:bg-black/80">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Back">
          <LuArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-medium">Applications</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-16 pt-6">
        {searchParams.get("discord_error") && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            Something went wrong connecting your Discord account. Please try again.
          </p>
        )}

        <div className="space-y-3">
          {POSITIONS.map((p) => (
            <div
              key={p.title}
              className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="mt-1 text-sm text-neutral-500">{p.description}</p>
              </div>
              <button
                onClick={() => startApply(p.title)}
                className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white"
              >
                Apply
              </button>
            </div>
          ))}
        </div>
      </div>

      {applyingTo && identity?.connected && identity.discordUsername && (
        <ApplyModal position={applyingTo} discordUsername={identity.discordUsername} onClose={() => setApplyingTo(null)} />
      )}

      <Modal open={closedNotice} onClose={() => setClosedNotice(false)} title="Applications closed">
        <p className="text-sm text-neutral-500">We're not accepting any more applications for this position right now.</p>
        <button
          onClick={() => setClosedNotice(false)}
          className="mt-6 rounded-full bg-brand px-5 py-2 font-medium text-white"
        >
          Got it
        </button>
      </Modal>
    </div>
  );
}

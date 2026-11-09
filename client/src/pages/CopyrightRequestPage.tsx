import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "../lib/queryStore";
import { LuArrowLeft } from "react-icons/lu";
import { api } from "../lib/api";

const inputClass =
  "w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900";
const labelClass = "mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300";

export default function CopyrightRequestPage() {
  const navigate = useNavigate();
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [copyrightedWork, setCopyrightedWork] = useState("");
  const [infringingUrls, setInfringingUrls] = useState("");
  const [details, setDetails] = useState("");
  const [signature, setSignature] = useState("");
  const [goodFaithConfirmed, setGoodFaithConfirmed] = useState(false);
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      api.post("/copyright/requests", {
        requesterName,
        requesterEmail,
        copyrightedWork,
        infringingUrls: infringingUrls
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        details,
        signature,
        goodFaithConfirmed,
        accuracyConfirmed,
      }),
  });

  const canSubmit =
    requesterName.trim() &&
    requesterEmail.trim() &&
    copyrightedWork.trim() &&
    infringingUrls.trim() &&
    signature.trim() &&
    goodFaithConfirmed &&
    accuracyConfirmed;

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="sticky top-0 z-10 flex items-center gap-4 bg-white/80 p-3 backdrop-blur dark:bg-black/80">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Back">
          <LuArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-medium">Copyright request</h1>
      </div>

      {submit.isSuccess ? (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-lg font-medium">Request submitted</p>
          <p className="mt-2 text-sm text-neutral-500">
            Thanks, our team will review your request and follow up at {requesterEmail} if needed.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-4 px-4 pb-16 pt-6">
          <p className="text-sm text-neutral-500">
            Use this form to report content on Socially that infringes your copyright. See our{" "}
            <Link to="/terms" className="text-brand hover:underline">
              Terms of Service
            </Link>{" "}
            for more on how we handle these requests. For counter-notices or other legal enquiries, email{" "}
            <a href="mailto:legal@socially.lol" className="text-brand hover:underline">
              legal@socially.lol
            </a>
            .
          </p>

          {submit.isError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
              {(submit.error as Error).message}
            </p>
          )}

          <div>
            <label className={labelClass}>Your name</label>
            <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} maxLength={100} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Email address</label>
            <input
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Copyrighted work</label>
            <p className="mb-1 text-xs text-neutral-400">Describe the work you own the rights to.</p>
            <textarea
              value={copyrightedWork}
              onChange={(e) => setCopyrightedWork(e.target.value)}
              rows={3}
              maxLength={500}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Infringing content (one link per line)</label>
            <p className="mb-1 text-xs text-neutral-400">Links to the posts, stories, or profiles on Socially you're reporting.</p>
            <textarea value={infringingUrls} onChange={(e) => setInfringingUrls(e.target.value)} rows={3} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Additional details (optional)</label>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={2000} className={inputClass} />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={goodFaithConfirmed} onChange={(e) => setGoodFaithConfirmed(e.target.checked)} className="mt-1" />
            <span>I have a good faith belief that the use of this material is not authorized by the copyright owner, its agent, or the law.</span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={accuracyConfirmed} onChange={(e) => setAccuracyConfirmed(e.target.checked)} className="mt-1" />
            <span>
              Under penalty of perjury, I declare that this information is accurate and that I am the copyright owner or authorized to
              act on their behalf.
            </span>
          </label>

          <div>
            <label className={labelClass}>Signature</label>
            <p className="mb-1 text-xs text-neutral-400">Type your full legal name to sign electronically.</p>
            <input value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={100} className={inputClass} />
          </div>

          <button
            onClick={() => submit.mutate()}
            disabled={!canSubmit || submit.isPending}
            className="rounded-full bg-brand px-5 py-2 font-medium text-white disabled:opacity-40"
          >
            {submit.isPending ? "Submitting…" : "Submit request"}
          </button>
        </div>
      )}
    </div>
  );
}

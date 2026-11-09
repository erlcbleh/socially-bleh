import { useState } from "react";
import { LuCheck } from "react-icons/lu";
import { useQuery } from "../lib/queryStore";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";

const STEPS = ["username", "interests", "terms"] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const { user, refetch } = useAuth();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState(user?.username || "");
  const [usernameError, setUsernameError] = useState("");
  const [checking, setChecking] = useState(false);
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [agreed, setAgreed] = useState(false);

  const { data: tagsData } = useQuery({
    queryKey: ["onboarding", "interest-tags"],
    queryFn: () => api.get<{ tags: string[] }>("/onboarding/interest-tags"),
  });

  const stepIndex = STEPS.indexOf(step);

  const submitUsername = async () => {
    setChecking(true);
    setUsernameError("");
    try {
      const { available } = await api.get<{ available: boolean }>(`/onboarding/check-username?u=${encodeURIComponent(username)}`);
      if (!available) {
        setUsernameError("That username is unavailable.");
        return;
      }
      await api.patch("/onboarding/username", { username });
      setStep("interests");
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setChecking(false);
    }
  };

  const submitInterests = async () => {
    await api.patch("/onboarding/interests", { interests });
    setStep("terms");
  };

  const finish = async () => {
    await api.post("/onboarding/complete");
    refetch();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-black">
      <div className="w-full max-w-md">
        <div className="mb-6 flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-brand" : "bg-neutral-200 dark:bg-neutral-800"}`} />
          ))}
        </div>

        {step === "username" && (
          <div>
            <h1 className="mb-1 text-2xl font-medium">Choose your handle</h1>
            <p className="mb-4 text-neutral-500">This is how people will find you on Socially.</p>
            <div className="flex items-center rounded-xl border border-neutral-300 px-3 py-2 focus-within:border-brand dark:border-neutral-700">
              <span className="text-neutral-400">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                className="w-full bg-transparent pl-1 outline-none"
                placeholder="username"
              />
            </div>
            {usernameError && <p className="mt-2 text-sm text-red-500">{usernameError}</p>}
            <button
              onClick={submitUsername}
              disabled={username.length < 3 || checking}
              className="mt-6 w-full rounded-full bg-brand py-3 font-medium text-white disabled:opacity-40"
            >
              {checking ? "Checking…" : "Next"}
            </button>
          </div>
        )}

        {step === "interests" && (
          <div>
            <h1 className="mb-1 text-2xl font-medium">What are you into?</h1>
            <p className="mb-4 text-neutral-500">Pick a few interests so we can tailor your feed in each community you join.</p>
            <div className="flex flex-wrap gap-2">
              {tagsData?.tags.map((tag) => {
                const selected = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() =>
                      setInterests((prev) => (selected ? prev.filter((t) => t !== tag) : [...prev, tag]))
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                      selected
                        ? "border-black bg-brand text-white dark:border-brand"
                        : "border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <button onClick={submitInterests} className="mt-6 w-full rounded-full bg-brand py-3 font-medium text-white">
              Next
            </button>
          </div>
        )}

        {step === "terms" && (
          <div>
            <h1 className="mb-1 text-2xl font-medium">Almost there</h1>
            <p className="mb-4 text-neutral-500">Review and accept our terms to start using Socially.</p>
            <button
              type="button"
              onClick={() => setAgreed((a) => !a)}
              aria-pressed={agreed}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left dark:border-neutral-700"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  agreed ? "border-brand bg-brand" : "border-neutral-400 dark:border-neutral-600"
                }`}
              >
                {agreed && <LuCheck className="h-3.5 w-3.5 text-white" />}
              </span>
              <span className="text-sm">
                I agree to Socially's{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="underline"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="underline"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </button>
            <button
              onClick={finish}
              disabled={!agreed}
              className="mt-6 w-full rounded-full bg-brand py-3 font-medium text-white disabled:opacity-40"
            >
              Let's go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

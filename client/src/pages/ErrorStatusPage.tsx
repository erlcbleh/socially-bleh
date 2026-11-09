import { Link, useParams } from "react-router-dom";
import { ErrorPage } from "../components/shared/ErrorPage";
import { statusCopyFor } from "../lib/statusCopy";

export default function ErrorStatusPage() {
  const { code } = useParams<{ code: string }>();
  const copy = statusCopyFor(code);

  if (code === "blocked") {
    return (
      <ErrorPage
        code={copy.code}
        title={copy.title}
        message={copy.message}
        action={
          <a
            href="mailto:support@socially.lol"
            className="rounded-full bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark"
          >
            Contact support
          </a>
        }
      />
    );
  }

  return (
    <ErrorPage
      code={copy.code}
      title={copy.title}
      message={copy.message}
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="rounded-full bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark">
            Go home
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full border border-neutral-300 px-6 py-2.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Try again
          </button>
        </div>
      }
    />
  );
}

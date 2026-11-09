import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorPage } from "./ErrorPage";
import { STATUS_COPY } from "../../lib/statusCopy";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const copy = STATUS_COPY["500"];
    return (
      <ErrorPage
        code={copy.code}
        title={copy.title}
        message={copy.message}
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => window.location.assign("/")}
              className="rounded-full bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark"
            >
              Go home
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full border border-neutral-300 px-6 py-2.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Reload
            </button>
          </div>
        }
      />
    );
  }
}

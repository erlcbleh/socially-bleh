import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTheme } from "../../lib/themeContext";

export function ErrorPage({
  code,
  title,
  message,
  action,
}: {
  code: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const { theme } = useTheme();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-y-auto bg-white px-6 text-center dark:bg-black">
      <img
        src={theme === "dark" ? "/wordmark-white.svg" : "/wordmark-black.svg"}
        alt="Socially"
        className="mb-10 h-7 w-auto opacity-40"
      />

      <p className="text-6xl font-semibold tabular-nums text-neutral-200 dark:text-neutral-800">{code}</p>
      <h1 className="mt-3 text-2xl font-medium">{title}</h1>
      <p className="mt-2 max-w-sm text-neutral-500">{message}</p>

      <div className="mt-8">
        {action ?? (
          <Link to="/" className="rounded-full bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark">
            Go home
          </Link>
        )}
      </div>
    </div>,
    document.body
  );
}

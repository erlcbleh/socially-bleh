import { ErrorPage } from "../components/shared/ErrorPage";
import { STATUS_COPY } from "../lib/statusCopy";

export default function NotFoundPage() {
  const copy = STATUS_COPY["404"];
  return <ErrorPage code={copy.code} title={copy.title} message={copy.message} />;
}

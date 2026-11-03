import { RiErrorWarningLine } from "@remixicon/react";

/** Shown instead of a page when a spreadsheet isn't configured or can't be reached. */
export function SetupNotice({ message, title = "Can't reach the spreadsheet" }: { message: string; title?: string }) {
  return (
    <section className="glass mx-4 mt-10 flex max-w-xl flex-col gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-6 sm:mx-auto sm:w-full">
      <div className="flex items-center gap-2">
        <RiErrorWarningLine className="size-5 text-text-error-primary" aria-hidden />
        <h1 className="text-title-3-semibold text-text-primary">{title}</h1>
      </div>
      <p className="text-body-regular text-text-secondary">
        Check the service-account key and the sheet IDs in <code>.env.local</code>, and that each sheet is shared with the
        service account as Editor.
      </p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-tertiary">
        {message}
      </pre>
    </section>
  );
}

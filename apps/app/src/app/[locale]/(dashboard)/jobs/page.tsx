"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 ring-yellow-600/20",
  running: "bg-blue-500/10 text-blue-600 ring-blue-600/20",
  done: "bg-green-500/10 text-green-600 ring-green-600/20",
  error: "bg-red-500/10 text-red-600 ring-red-600/20",
};

export default function JobsPage() {
  const { current } = useWorkspace();
  const {
    results: jobs,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.jobs.listPaged,
    current ? { workspaceId: current } : "skip",
    { initialNumItems: 20 },
  );
  const createJob = useMutation(api.jobs.create);
  const [pending, setPending] = useState(false);

  const runDemo = async () => {
    if (!current) return;
    setPending(true);
    try {
      await createJob({
        workspaceId: current,
        kind: "demo",
        input: { prompt: "hello world" },
      });
      toast.success("Job queued");
    } catch {
      toast.error("Couldn't queue job");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-screen-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-primary">Jobs</h1>
            <p className="text-sm text-primary/60">
              Workspace-scoped. Created in Convex → processed by the external
              backend → completed via webhook. Updates live.
            </p>
          </div>
          <Button onClick={runDemo} disabled={pending || !current}>
            {pending ? "Creating…" : "Run demo job"}
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-primary/60">
              <tr>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {status === "LoadingFirstPage" && (
                <tr>
                  <td className="px-4 py-6 text-primary/40" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              )}
              {status !== "LoadingFirstPage" && jobs.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-primary/40" colSpan={4}>
                    No jobs yet — click “Run demo job”.
                  </td>
                </tr>
              )}
              {jobs.map((job) => (
                <tr
                  key={job._id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-primary/80">
                    {job.kind}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        statusStyles[job.status] ?? ""
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="max-w-[420px] truncate px-4 py-3 font-mono text-xs text-primary/60">
                    {job.result
                      ? JSON.stringify(job.result)
                      : job.error
                        ? `⚠ ${job.error}`
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-primary/50">
                    {new Date(job.updatedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {status === "CanLoadMore" && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => loadMore(20)}>
              Load more
            </Button>
          </div>
        )}
        {status === "LoadingMore" && (
          <p className="mt-4 text-center text-sm text-primary/40">Loading…</p>
        )}
      </div>
    </div>
  );
}

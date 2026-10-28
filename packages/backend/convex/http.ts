import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { polar } from "./subscriptions";

const http = httpRouter();

auth.addHttpRoutes(http);

// Register the webhook handler at /polar/events
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
polar.registerRoutes(http as any);

// --- Hybrid adapter WEBHOOK PATH: external backend posts results/events here ---
http.route({
  path: "/backend/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = req.headers.get("x-webhook-secret");
    if (!secret || secret !== process.env.BACKEND_WEBHOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
    const payload = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const type = typeof payload.type === "string" ? payload.type : "event";

    if (type === "job.result" && typeof payload.jobId === "string") {
      try {
        await ctx.runMutation(internal.jobs.complete, {
          // biome-ignore lint/suspicious/noExplicitAny: id validated by Convex
          jobId: payload.jobId as any,
          result: payload.result,
          error: typeof payload.error === "string" ? payload.error : undefined,
        });
      } catch {}
      if (typeof payload.projectId === "string") {
        const res = (payload.result || {}) as any;
        try {
          await ctx.runMutation(internal.projects.updateProjectResult, {
            projectId: payload.projectId as any,
            workspaceId: typeof payload.workspaceId === "string" ? payload.workspaceId : undefined,
            name: typeof res.title === "string" ? res.title : undefined,
            status: typeof res.status === "string" ? res.status : "completed",
            outputUrl: typeof res.outputUrl === "string" ? res.outputUrl : (res.videoUrl || undefined),
            cdnUrl: typeof res.cdnUrl === "string" ? res.cdnUrl : (res.videoUrl || undefined),
            storageUrl: typeof res.storageUrl === "string" ? res.storageUrl : (res.videoUrl || undefined),
            storageKey: typeof res.storageKey === "string" ? res.storageKey : undefined,
            storageProvider: typeof res.storageProvider === "string" ? res.storageProvider : undefined,
            fileSize: typeof res.fileSize === "number" ? res.fileSize : undefined,
            mimeType: typeof res.mimeType === "string" ? res.mimeType : "video/mp4",
            validationStatus: typeof res.validationStatus === "string" ? res.validationStatus : "PASSED",
            renderTimeSeconds: typeof res.renderTimeSeconds === "number" ? res.renderTimeSeconds : undefined,
            thumbnailUrl: typeof res.thumbnailUrl === "string" ? res.thumbnailUrl : undefined,
            thumbnailCdnUrl: typeof res.thumbnailCdnUrl === "string" ? res.thumbnailCdnUrl : undefined,
            thumbnailStorageKey: typeof res.thumbnailStorageKey === "string" ? res.thumbnailStorageKey : undefined,
            thumbnailStatus: typeof res.thumbnailStatus === "string" ? res.thumbnailStatus : "completed",
            thumbnailFileSize: typeof res.thumbnailFileSize === "number" ? res.thumbnailFileSize : undefined,
            renders: Array.isArray(res.renders) ? (res.renders as any) : undefined,
          });
        } catch {}
      }
    } else if (type === "project.result" && typeof payload.projectId === "string") {
      await ctx.runMutation(internal.projects.updateProjectResult, {
        // biome-ignore lint/suspicious/noExplicitAny: id validated by Convex
        projectId: payload.projectId as any,
        workspaceId: typeof payload.workspaceId === "string" ? payload.workspaceId : undefined,
        name: typeof payload.name === "string" ? payload.name : undefined,
        status: typeof payload.status === "string" ? payload.status : "completed",
        outputUrl: typeof payload.outputUrl === "string" ? payload.outputUrl : undefined,
        cdnUrl: typeof payload.cdnUrl === "string" ? payload.cdnUrl : undefined,
        storageUrl: typeof payload.storageUrl === "string" ? payload.storageUrl : undefined,
        storageKey: typeof payload.storageKey === "string" ? payload.storageKey : undefined,
        storageProvider: typeof payload.storageProvider === "string" ? payload.storageProvider : undefined,
        storageBucket: typeof payload.storageBucket === "string" ? payload.storageBucket : undefined,
        fileSize: typeof payload.fileSize === "number" ? payload.fileSize : undefined,
        mimeType: typeof payload.mimeType === "string" ? payload.mimeType : undefined,
        validationStatus: typeof payload.validationStatus === "string" ? payload.validationStatus : "PASSED",
        renderTimeSeconds: typeof payload.renderTimeSeconds === "number" ? payload.renderTimeSeconds : undefined,
        thumbnailUrl: typeof payload.thumbnailUrl === "string" ? payload.thumbnailUrl : undefined,
        thumbnailCdnUrl: typeof payload.thumbnailCdnUrl === "string" ? payload.thumbnailCdnUrl : undefined,
        thumbnailStorageKey: typeof payload.thumbnailStorageKey === "string" ? payload.thumbnailStorageKey : undefined,
        thumbnailStatus: typeof payload.thumbnailStatus === "string" ? payload.thumbnailStatus : undefined,
        thumbnailFileSize: typeof payload.thumbnailFileSize === "number" ? payload.thumbnailFileSize : undefined,
        renders: Array.isArray(payload.renders) ? (payload.renders as any) : undefined,
      });
    } else if (type === "job.progress" && typeof payload.jobId === "string") {
      const status =
        typeof payload.status === "string" ? payload.status : "running";
      await ctx.runMutation(internal.jobs.setStatus, {
        // biome-ignore lint/suspicious/noExplicitAny: id validated by Convex
        jobId: payload.jobId as any,
        status,
      });
      if (typeof payload.projectId === "string") {
        await ctx.runMutation(internal.projects.updateProjectResult, {
          // biome-ignore lint/suspicious/noExplicitAny: id validated by Convex
          projectId: payload.projectId as any,
          status,
        });
      }
    } else {
      await ctx.runMutation(internal.backend.ingestEvent, {
        workspaceId:
          typeof payload.workspaceId === "string"
            ? // biome-ignore lint/suspicious/noExplicitAny: id validated by Convex
              (payload.workspaceId as any)
            : undefined,
        source: "backend",
        type,
        payload,
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
});

// --- API key verification (programmatic access) ---
http.route({
  path: "/api/verify-key",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const key = req.headers.get("x-api-key") ?? "";
    const json = (body: unknown, status: number) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (!key) return json({ valid: false }, 401);
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(key),
    );
    const hash = Array.from(new Uint8Array(buf), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const found = await ctx.runQuery(internal.apiKeys.resolveByHash, { hash });
    return json({ valid: !!found, ...(found ?? {}) }, found ? 200 : 401);
  }),
});

export default http;

import { PixelForgeError } from "@pixelforge/image-contracts";
import { newId } from "../lib/errors";
import { type CollageRequest, type CollageResult, renderCollage } from "../processing/collage";

interface PendingJob {
  resolve: (result: CollageResult) => void;
  reject: (error: unknown) => void;
}

type CollageWorkerResponse =
  | { type: "result"; jobId: string; result: CollageResult }
  | { type: "error"; jobId: string; message: string; hint: string };

export class CollageProcessor {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingJob>();
  private disposed = false;

  constructor() {
    this.spawn();
  }

  private spawn(): void {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
      this.worker = null;
      return;
    }
    try {
      this.worker = new Worker(new URL("./collage.worker.ts", import.meta.url), {
        type: "module",
        name: "pixelforge-collage-worker",
      });
      this.worker.onmessage = (event: MessageEvent<CollageWorkerResponse>) =>
        this.handleMessage(event.data);
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.failAll(
          new PixelForgeError(
            "WORKER_FAILED",
            "The collage worker stopped unexpectedly.",
            "Try the composition again.",
          ),
        );
        this.restart();
      };
    } catch {
      this.worker = null;
    }
  }

  private restart(): void {
    this.worker?.terminate();
    this.worker = null;
    if (!this.disposed) this.spawn();
  }

  private handleMessage(message: CollageWorkerResponse): void {
    const job = this.pending.get(message.jobId);
    this.pending.delete(message.jobId);
    if (!job) return;
    if (message.type === "result") {
      job.resolve(message.result);
    } else {
      job.reject(new PixelForgeError("WORKER_FAILED", message.message, message.hint));
    }
  }

  private failAll(error: unknown): void {
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }

  render(request: CollageRequest, scale = 1): Promise<CollageResult> {
    if (this.disposed) {
      return Promise.reject(
        new PixelForgeError("WORKER_FAILED", "The collage processor was disposed."),
      );
    }
    if (!this.worker) return renderCollage(request, scale);
    const jobId = newId("collage");
    return new Promise<CollageResult>((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject });
      this.worker?.postMessage({ type: "render", jobId, request, scale });
    });
  }

  dispose(): void {
    this.disposed = true;
    this.failAll(new PixelForgeError("CANCELLED", "The collage processor was disposed."));
    this.worker?.terminate();
    this.worker = null;
  }
}

export const collageProcessor = new CollageProcessor();

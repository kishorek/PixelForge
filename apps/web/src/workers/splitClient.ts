import { PixelForgeError } from "@pixelforge/image-contracts";
import { newId } from "../lib/errors";
import { type SplitRequest, type SplitResult, renderSplit } from "../processing/split";

interface PendingJob {
  resolve: (result: SplitResult) => void;
  reject: (error: unknown) => void;
}

type SplitResponse =
  | { type: "result"; jobId: string; result: SplitResult }
  | { type: "error"; jobId: string; message: string; hint: string };

export class SplitProcessor {
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
      this.worker = new Worker(new URL("./split.worker.ts", import.meta.url), {
        type: "module",
        name: "pixelforge-split-worker",
      });
      this.worker.onmessage = (event: MessageEvent<SplitResponse>) =>
        this.handleMessage(event.data);
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.failAll(
          new PixelForgeError(
            "WORKER_FAILED",
            "The split worker stopped unexpectedly.",
            "Try the split again.",
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

  private handleMessage(message: SplitResponse): void {
    const job = this.pending.get(message.jobId);
    this.pending.delete(message.jobId);
    if (!job) return;
    if (message.type === "result") job.resolve(message.result);
    else job.reject(new PixelForgeError("WORKER_FAILED", message.message, message.hint));
  }

  private failAll(error: unknown): void {
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }

  split(request: SplitRequest): Promise<SplitResult> {
    if (this.disposed) {
      return Promise.reject(
        new PixelForgeError("WORKER_FAILED", "The split processor was disposed."),
      );
    }
    if (!this.worker) return renderSplit(request);
    const jobId = newId("split");
    return new Promise<SplitResult>((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject });
      this.worker?.postMessage({ type: "split", jobId, request });
    });
  }

  dispose(): void {
    this.disposed = true;
    this.failAll(new PixelForgeError("CANCELLED", "The split processor was disposed."));
    this.worker?.terminate();
    this.worker = null;
  }
}

export const splitProcessor = new SplitProcessor();

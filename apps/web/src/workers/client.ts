import { PixelForgeError } from "@pixelforge/image-contracts";
import type { ProcessProgress, ProcessRequest, ProcessResult } from "@pixelforge/image-contracts";
import { processImage } from "../processing/process";
import type { WorkerRequest, WorkerResponse } from "./protocol";

interface PendingJob {
  resolve: (result: ProcessResult) => void;
  reject: (error: unknown) => void;
  onProgress?: (progress: ProcessProgress) => void;
}

export class ImageProcessor {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingJob>();
  private disposed = false;

  constructor() {
    this.spawnWorker();
  }

  private spawnWorker(): void {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
      this.worker = null;
      return;
    }
    try {
      this.worker = new Worker(new URL("./image.worker.ts", import.meta.url), {
        type: "module",
        name: "pixelforge-image-worker",
      });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
        this.handleMessage(event.data);
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.failAll(
          new PixelForgeError(
            "WORKER_FAILED",
            "The image worker stopped unexpectedly.",
            "Try the operation again.",
          ),
        );
        this.restartWorker();
      };
    } catch {
      this.worker = null;
    }
  }

  private restartWorker(): void {
    this.worker?.terminate();
    this.worker = null;
    if (!this.disposed) this.spawnWorker();
  }

  private handleMessage(message: WorkerResponse): void {
    if (message.type === "progress") {
      this.pending.get(message.progress.jobId)?.onProgress?.(message.progress);
      return;
    }
    if (message.type === "result") {
      const job = this.pending.get(message.result.jobId);
      this.pending.delete(message.result.jobId);
      job?.resolve(message.result);
      return;
    }
    const job = this.pending.get(message.jobId);
    this.pending.delete(message.jobId);
    job?.reject(new PixelForgeError(message.code, message.message, message.hint));
  }

  private failAll(error: unknown): void {
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }

  process(
    request: ProcessRequest,
    onProgress?: (progress: ProcessProgress) => void,
  ): Promise<ProcessResult> {
    if (this.disposed) {
      return Promise.reject(
        new PixelForgeError("WORKER_FAILED", "The processor has been disposed."),
      );
    }
    if (!this.worker) {
      return processImage(request, onProgress);
    }
    return new Promise<ProcessResult>((resolve, reject) => {
      this.pending.set(request.jobId, { resolve, reject, onProgress });
      const message: WorkerRequest = { type: "process", request };
      this.worker?.postMessage(message);
    });
  }

  cancelAll(): void {
    if (this.pending.size === 0 && !this.worker) return;
    this.failAll(
      new PixelForgeError(
        "CANCELLED",
        "The operation was cancelled.",
        "Adjust your settings and try again.",
      ),
    );
    this.restartWorker();
  }

  dispose(): void {
    this.disposed = true;
    this.failAll(new PixelForgeError("CANCELLED", "The processor has been disposed."));
    this.worker?.terminate();
    this.worker = null;
  }
}

export const imageProcessor = new ImageProcessor();

import { PixelForgeError } from "@pixelforge/image-contracts";
import { processImage } from "../processing/process";
import { loadPixelforgeWasm } from "../wasm/loader";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const engine = loadPixelforgeWasm();

const post = (message: WorkerResponse) => {
  (self as unknown as Worker).postMessage(message);
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  if (data.type !== "process") return;
  const { request } = data;

  try {
    const wasm = await engine;
    const result = await processImage(
      request,
      (progress) => post({ type: "progress", progress }),
      wasm,
    );
    post({ type: "result", result });
  } catch (error) {
    if (error instanceof PixelForgeError) {
      post({
        type: "error",
        jobId: request.jobId,
        code: error.code,
        message: error.message,
        hint: error.hint,
      });
    } else {
      post({
        type: "error",
        jobId: request.jobId,
        code: "WORKER_FAILED",
        message: error instanceof Error ? error.message : String(error),
        hint: "Try again, or reload the page.",
      });
    }
  }
};

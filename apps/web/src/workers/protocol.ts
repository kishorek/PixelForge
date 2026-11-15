import type {
  ProcessErrorCode,
  ProcessProgress,
  ProcessRequest,
  ProcessResult,
} from "@pixelforge/image-contracts";

export type WorkerRequest = { type: "process"; request: ProcessRequest };

export type WorkerResponse =
  | { type: "progress"; progress: ProcessProgress }
  | { type: "result"; result: ProcessResult }
  | { type: "error"; jobId: string; code: ProcessErrorCode; message: string; hint: string };

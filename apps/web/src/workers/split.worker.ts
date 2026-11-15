import { PixelForgeError } from "@pixelforge/image-contracts";
import { type SplitRequest, type SplitResult, renderSplit } from "../processing/split";

interface SplitMessage {
  type: "split";
  jobId: string;
  request: SplitRequest;
}

type SplitResponse =
  | { type: "result"; jobId: string; result: SplitResult }
  | { type: "error"; jobId: string; message: string; hint: string };

self.onmessage = async (event: MessageEvent<SplitMessage>) => {
  if (event.data.type !== "split") return;
  const { jobId, request } = event.data;
  const post = (message: SplitResponse) => (self as unknown as Worker).postMessage(message);
  try {
    const result = await renderSplit(request);
    post({ type: "result", jobId, result });
  } catch (error) {
    if (error instanceof PixelForgeError) {
      post({ type: "error", jobId, message: error.message, hint: error.hint });
    } else {
      post({
        type: "error",
        jobId,
        message: error instanceof Error ? error.message : String(error),
        hint: "Try a smaller image or fewer tiles.",
      });
    }
  }
};

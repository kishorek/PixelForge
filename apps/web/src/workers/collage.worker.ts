import { PixelForgeError } from "@pixelforge/image-contracts";
import { type CollageRequest, type CollageResult, renderCollage } from "../processing/collage";

interface RenderMessage {
  type: "render";
  jobId: string;
  request: CollageRequest;
  scale: number;
}

type CollageWorkerResponse =
  | { type: "result"; jobId: string; result: CollageResult }
  | { type: "error"; jobId: string; message: string; hint: string };

self.onmessage = async (event: MessageEvent<RenderMessage>) => {
  if (event.data.type !== "render") return;
  const { jobId, request, scale } = event.data;
  const post = (message: CollageWorkerResponse) => (self as unknown as Worker).postMessage(message);
  try {
    const result = await renderCollage(request, scale);
    post({ type: "result", jobId, result });
  } catch (error) {
    if (error instanceof PixelForgeError) {
      post({ type: "error", jobId, message: error.message, hint: error.hint });
    } else {
      post({
        type: "error",
        jobId,
        message: error instanceof Error ? error.message : String(error),
        hint: "Try a smaller collage or fewer images.",
      });
    }
  }
};

import { YoutubeTranscript } from "youtube-transcript";
import { youtubeVideoId } from "./youtube-url";

export async function extractYoutube(
  url: string
): Promise<{ title: string; text: string }> {
  const videoId = youtubeVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  if (!transcript || transcript.length === 0)
    throw new Error("No transcript available for this video");

  const text = transcript
    .map((seg) => {
      const seconds = Math.floor(seg.offset / 1000);
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `[${m}:${String(s).padStart(2, "0")}] ${seg.text}`;
    })
    .join(" ");

  return {
    title: `YouTube Video (${videoId})`,
    text,
  };
}

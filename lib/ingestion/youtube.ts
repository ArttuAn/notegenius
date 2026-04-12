import { YoutubeTranscript } from "youtube-transcript";

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function extractYoutube(
  url: string
): Promise<{ title: string; text: string }> {
  const videoId = extractVideoId(url);
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

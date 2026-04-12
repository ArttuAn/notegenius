import axios from "axios";
import * as cheerio from "cheerio";

export async function extractUrl(url: string): Promise<{ title: string; text: string }> {
  const { data } = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; NoteGenius/1.0; +https://github.com/notegenius)",
    },
    maxContentLength: 5 * 1024 * 1024, // 5MB max
  });

  const $ = cheerio.load(data);

  // Remove non-content elements
  $("script, style, nav, footer, header, aside, iframe, noscript, .ad, .advertisement, .sidebar").remove();

  const title =
    $("meta[property='og:title']").attr("content") ||
    $("title").text().trim() ||
    url;

  // Extract meaningful text
  const bodyText = $("article, main, .content, .post, body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return { title, text: bodyText };
}

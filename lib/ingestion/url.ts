import { fetchPublicPage } from "./public-http";
import * as cheerio from "cheerio";

export async function extractUrl(url: string): Promise<{ title: string; text: string }> {
  const data = await fetchPublicPage(url);

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

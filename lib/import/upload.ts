import { getToken, getUris } from "@/lib/api/client";
import { extractS3KeyFromUrl } from "@/lib/s3/extract-key";

/**
 * Presign-then-PUT via the backend's Uppy-compatible /s3/sign endpoint
 * (POST { filename, type } → { key, url, method }). The stored s3key MUST be
 * derived from the signed url — the response `key` lacks the user/prefix
 * segments that only appear in the url path.
 */
export async function uploadFileToS3(file: File): Promise<string> {
  const uris = await getUris();
  const token = await getToken();
  if (!token) throw new Error("No valid session token available.");
  const contentType = file.type || "application/octet-stream";

  const signRes = await fetch(`${uris.base}/s3/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filename: file.name, type: contentType }),
  });
  if (!signRes.ok) {
    const detail = await signRes
      .json()
      .then((j) => j.detail ?? signRes.statusText)
      .catch(() => signRes.statusText);
    throw new Error(detail);
  }
  const { url, method } = (await signRes.json()) as { url: string; method?: string };

  const putRes = await fetch(url, {
    method: method ?? "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

  return extractS3KeyFromUrl(url);
}

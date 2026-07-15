/**
 * Converts a presigned S3 upload URL back into the raw object key stored in
 * file fields. Moved verbatim out of hooks/use-uppy.tsx so pure modules
 * (lib/import/upload.ts) can use it without importing Uppy.
 */
export function extractS3KeyFromUrl(uploadURL: string): string {
  try {
    const url = new URL(uploadURL);
    const hostname = url.hostname;
    // url.pathname is percent-encoded (spaces → %20, "–" → %E2%80%93, etc.).
    // Decode it so the stored s3Key is the raw object key — otherwise the
    // backend re-encodes it when presigning (%20 → %2520) and S3 404s on a
    // key that doesn't exist.
    const rawPath = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
    const keyPath = decodeURIComponent(rawPath);
    // Virtual-hosted-style AWS S3 URLs put the bucket in the subdomain:
    // <bucket>.s3.<region>.amazonaws.com/<key> → re-prepend the bucket.
    // Custom / MinIO endpoints (e.g. api.s3.exulu.com) are path-style — the
    // bucket is already the first path segment — so the pathname IS the
    // bucket/key. Guard on amazonaws.com so a host like "api.s3.exulu.com"
    // isn't mistaken for a virtual-hosted bucket named "api".
    const isAwsVirtualHosted =
      hostname.endsWith(".amazonaws.com") && /\.s3[.-]/.test(hostname);
    if (isAwsVirtualHosted) {
      const parts = hostname.split(/\.s3[.-]/);
      const bucket = parts[0];
      return `${bucket}/${keyPath}`;
    }
    return keyPath;
  } catch (e) {
    console.error("Failed to parse S3 upload URL:", e);
    return uploadURL.split("/").pop() || "";
  }
}

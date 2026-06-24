const baseHref = (endpoint: string): string =>
  new URL(endpoint).href.replace(/\/$/, "");

export const isS3ArtifactUrl = (href: string, s3Endpoint: string): boolean => {
  if (!s3Endpoint) return false;
  try {
    return new URL(href).href.startsWith(baseHref(s3Endpoint));
  } catch {
    return false;
  }
};

export const extractS3Key = (href: string, s3Endpoint: string): string | null => {
  if (!isS3ArtifactUrl(href, s3Endpoint)) return null;
  try {
    const base = new URL(s3Endpoint);
    const url = new URL(href);
    const basePath = base.pathname.replace(/\/$/, "");
    const rest = url.pathname.slice(basePath.length).replace(/^\/+/, "");
    const key = rest
      .split("/")
      .map((s) => decodeURIComponent(s))
      .join("/");
    return key || null;
  } catch {
    return null;
  }
};

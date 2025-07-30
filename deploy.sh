docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --cache-from ghcr.io/qventu/exulu-frontend:latest \
  -t ghcr.io/qventu/exulu-frontend:latest \
  --push .

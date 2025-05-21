/** @type {import('next').NextConfig} */


const config = {
  productionBrowserSourceMaps: true,
  images: {
    domains: ["img.clerk.com", "replicate.delivery", "www.1822direkt.de", "1822direkt.de"],
  },
  experimental: {
    serverComponentsExternalPackages: [
      "sharp",
      "onnxruntime-node",
      "graphql",
      "mongoose",
      "graphql-compose-mongoose",
      "graphql-compose",
    ],
  },
  webpack( config,
           { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) {
    config.externals.push({ vectordb: "vectordb" });
    return config;
  },
};

if (process.env.DOCKER) {
  config.output = "standalone";
}

module.exports = config;

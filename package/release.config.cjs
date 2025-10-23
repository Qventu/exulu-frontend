module.exports = {
    branches: ['main'],
    tagFormat: 'npm-v${version}', // avoids conflict with Docker 'vX.Y.Z' tags
    plugins: [
      [
        '@semantic-release/commit-analyzer',
        {
          preset: 'conventionalcommits',
        },
      ],
      '@semantic-release/release-notes-generator',
      [
        '@semantic-release/npm',
        {
          npmPublish: true,
          pkgRoot: '.', // run inside /package
        },
      ],
      // Optional: if you still want to post release notes to GitHub
      [
        '@semantic-release/github',
        {
          successComment: false,
          failComment: false,
          assets: [],
        },
      ],
    ],
  };
  
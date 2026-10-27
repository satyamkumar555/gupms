/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true, poweredByHeader: false,
  output: "export",            // static website -> apps/web/out, served by Firebase Hosting
  images: { unoptimized: true },
};

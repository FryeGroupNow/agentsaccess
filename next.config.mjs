/** @type {import('next').NextConfig} */
const nextConfig = {
  // Never redirect to add/remove trailing slashes on API routes.
  // Without this, a POST to /api/webhooks/stripe/ would 307 → /api/webhooks/stripe
  // and Stripe would re-send the payload to the redirected URL.
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

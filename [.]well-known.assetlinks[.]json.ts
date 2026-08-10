import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { APP_ID, ANDROID_CERT_SHA256 } from "@/lib/app-stores";

/**
 * Digital Asset Links — يربط الموقع بتطبيق أندرويد عبر مفتاح التوقيع.
 * مطلوب لمتجر Play حتى تُفتح روابط الموقع داخل التطبيق (App Links) والدخول عبر Google.
 */
export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: APP_ID,
              sha256_cert_fingerprints: ANDROID_CERT_SHA256,
            },
          },
        ];
        return new Response(JSON.stringify(body, null, 2), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

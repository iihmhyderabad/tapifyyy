import { createFileRoute, redirect } from "@tanstack/react-router";

// The dashboard is the app's home. Sends visitors straight to it; the
// dashboard remains open without a sign-in gate.
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "QR/NFC Card Manager — Dynamic QR Manager" },
    { name: "description", content: "Manage dynamic QR/NFC cards and their destination links." },
    { property: "og:title", content: "QR/NFC Card Manager — Dynamic QR Manager" },
    { property: "og:description", content: "Manage dynamic QR/NFC cards and their destination links." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

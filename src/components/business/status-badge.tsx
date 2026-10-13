import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/form";

const TONES = {
  draft: "neutral",
  pending_review: "info",
  changes_requested: "warning",
  approved: "success",
  live: "success",
  hidden: "warning",
  rejected: "danger",
  suspended: "danger",
  paused: "neutral",
} as const;

/** Status pill for businesses and listings. Approved + public listings read as "Live". */
export function StatusBadge({ status, isPublic }: { status: string; isPublic?: boolean }) {
  const t = useTranslations("status");
  const key = (
    status === "approved" && isPublic !== undefined ? (isPublic ? "live" : "hidden") : status
  ) as keyof typeof TONES;
  return <Badge tone={TONES[key] ?? "neutral"}>{t.has(key) ? t(key) : status}</Badge>;
}

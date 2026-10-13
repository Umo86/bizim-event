/** Wordmark: a stylised tulip-dot over "Bizim Event". Original artwork. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#0E9AA7" />
        <path d="M16 7c-3 3-5 6-5 9a5 5 0 0 0 10 0c0-3-2-6-5-9Z" fill="#FFFFFF" />
        <circle cx="16" cy="24.5" r="2" fill="#FF6B5B" />
      </svg>
      <span className="font-heading text-lg font-extrabold tracking-tight text-ink">
        Bizim<span className="text-primary-strong">Event</span>
      </span>
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { COUNTRY_COOKIE, DEFAULT_COUNTRY, flagEmoji } from "@/lib/country";

type Option = { iso2: string; name: string };

function readCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

/** Header country selector — stores the choice in a cookie (overrides the IP default). */
export function CountrySelect({ options, label }: { options: Option[]; label: string }) {
  const [value, setValue] = useState(DEFAULT_COUNTRY);

  useEffect(() => {
    // Sync with the cookie set by the proxy after hydration (avoids a mismatch).
    const fromCookie = readCookie(COUNTRY_COOKIE);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromCookie) setValue(fromCookie);
  }, []);

  const onChange = (iso2: string) => {
    setValue(iso2);
    document.cookie = `${COUNTRY_COOKIE}=${iso2}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  };

  return (
    <label className="relative flex items-center gap-1 text-sm">
      <span className="sr-only">{label}</span>
      <span aria-hidden>{flagEmoji(value)}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-28 cursor-pointer truncate rounded-lg border border-line bg-white py-1.5 pl-1 pr-6 text-sm"
      >
        {options.map((o) => (
          <option key={o.iso2} value={o.iso2}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

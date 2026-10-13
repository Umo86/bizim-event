"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import type { z } from "zod";

/**
 * Runs a step's strict schema on Continue and turns issues into translated,
 * per-field messages (first issue per field wins).
 */
export function useStepValidation<S extends z.ZodType>(schema: S) {
  const tv = useTranslations("validation");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const message = useCallback((code: string) => (tv.has(code) ? tv(code) : tv("invalid")), [tv]);

  const validate = useCallback(
    (values: unknown) => {
      const r = schema.safeParse(values);
      if (r.success) {
        setErrors({});
        return true;
      }
      const map: Record<string, string> = {};
      for (const issue of r.error.issues) {
        const key = String(issue.path[0] ?? "_form");
        if (!map[key]) map[key] = message(issue.message);
      }
      setErrors(map);
      return false;
    },
    [schema, message],
  );

  /** Merge server "invalid" field names from autosave into the error map. */
  const withServerInvalid = useCallback(
    (invalid: string[], codes: Record<string, string> = {}) => {
      const merged = { ...errors };
      for (const f of invalid) if (!merged[f]) merged[f] = message(codes[f] ?? "invalid");
      return merged;
    },
    [errors, message],
  );

  return { errors, setErrors, validate, withServerInvalid, message };
}

import { customType, timestamp, uuid } from "drizzle-orm/pg-core";

/** PostGIS geography(Point, 4326). Stored/read as { lng, lat }. */
export type LngLat = { lng: number; lat: number };

export const geographyPoint = customType<{ data: LngLat; driverData: string }>({
  dataType() {
    return "geo_point"; // domain over geography(Point, 4326) — see drizzle/0000_extensions.sql
  },
  toDriver(value) {
    // EWKT is accepted by PostGIS for geography input.
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value) {
    return parseWkbPoint(value);
  },
});

/** Full-text search vector. */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * PostGIS returns geography as hex-encoded EWKB. Decode a Point without pulling
 * in a GIS library (little/big endian, optional SRID flag).
 */
export function parseWkbPoint(hex: string): LngLat {
  if (typeof hex !== "string" || hex.length < 42) {
    throw new Error("Invalid WKB point");
  }
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const view = new DataView(bytes.buffer);
  const little = view.getUint8(0) === 1;
  const type = view.getUint32(1, little);
  let offset = 5;
  if (type & 0x20000000) offset += 4; // SRID present
  const lng = view.getFloat64(offset, little);
  const lat = view.getFloat64(offset + 8, little);
  return { lng, lat };
}

export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

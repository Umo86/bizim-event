import { getTableName, sql, type AnyColumn, type Table } from "drizzle-orm";

/**
 * A table-qualified column reference ("listings"."id") for correlated subqueries.
 *
 * Drizzle drops the table name from columns in single-table selects, so
 * `(select … from listing_media m where m.listing_id = ${listings.id})` renders
 * `m.listing_id = "id"`, which Postgres binds to the INNER table's id and silently
 * returns the wrong rows. Always use this inside raw subqueries.
 */
export function qualified(table: Table, column: AnyColumn) {
  return sql`${sql.identifier(getTableName(table))}.${sql.identifier(column.name)}`;
}

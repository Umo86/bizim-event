/**
 * Data-access layer. ALL database access goes through these functions; each
 * calls an authorisation guard (see ./guards.ts) before touching data.
 * Components and route handlers must never import "@/db" directly.
 */
export * from "./context";
export * from "./errors";
export * as publicData from "./public";
export * as enquiriesDal from "./enquiries";
export * as bookingsDal from "./bookings";
export * as businessesDal from "./businesses";
export * as adminDal from "./admin";

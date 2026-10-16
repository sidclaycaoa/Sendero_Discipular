import { drizzle } from "drizzle-orm/d1";
import { getSenderoDb } from "@/lib/db/bindings";
import * as schema from "./schema";

export function getDb() {
  return drizzle(getSenderoDb(), { schema });
}

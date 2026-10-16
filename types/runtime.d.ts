// D1/Fetcher contracts used by this Worker (no runtime dependency).
interface D1Result<T = unknown> { results: T[]; success: boolean; meta: Record<string, unknown>; }
interface D1PreparedStatement {
  bind(...values: (string | number | null)[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
interface Fetcher { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>; }

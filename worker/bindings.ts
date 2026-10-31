/**
 * Runtime binding contracts. Keep infrastructure dependencies behind these
 * interfaces so UI code never imports Cloudflare APIs.
 *
 * DB and PHOTOS are OPTIONAL until the live backend is activated. Binding
 * their resources alone does not enable authentication or database writes.
 */
export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
}

export interface D1DatabaseBinding {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

export interface R2ObjectBinding {
  body: ReadableStream<Uint8Array>;
  httpMetadata?: { contentType?: string };
}

export interface R2BucketBinding {
  get(key: string): Promise<R2ObjectBinding | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | Uint8Array | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export interface WorkerEnv {
  ASSETS: AssetFetcher;
  DB?: D1DatabaseBinding;
  PHOTOS?: R2BucketBinding;
  /** Do not enable the live API based on a client-supplied user or role. */
}

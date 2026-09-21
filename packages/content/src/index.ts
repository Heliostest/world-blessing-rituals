import { sha256 as hash } from "@noble/hashes/sha256";

export const MAX_ASSET_BYTES = 64 * 1024 * 1024;
export const CACHE_BUDGET = 256 * 1024 * 1024;
export const createSHA256 = () => hash.create();
/** Only deterministic content defects may be durably rejected. */
export class InvalidContentError extends Error {}
export const DEFAULT_PARAMETERS = {
  headRadius: 0.255,
  gripOffset: [0.65, -0.9, 0.1] as [number, number, number],
  exposure: 1.1,
  keyIntensity: 3.2,
  fillIntensity: 0.65,
  rimIntensity: 0.9,
  liftMs: 170,
  strikeMs: 95,
  reboundMs: 95,
  settleMs: 140,
};
export type Asset = { path: string; bytes: number; sha256: string };
export type Pack = {
  schemaVersion: 1;
  sceneId: "woodfish";
  revision: string;
  engine: "woodfish@1";
  model: Asset;
  sound?: Asset;
  bindings: { body: string; mallet: string };
  parameters: typeof DEFAULT_PARAMETERS;
  copy: { instruction: string };
};
export function sha256(bytes: ArrayBuffer) {
  return Array.from(hash(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function object(value: unknown, keys: string[]): Record<string, any> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw Error("Invalid content fields");
  return value as Record<string, any>;
}
function str(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error("Invalid content text");
  return value;
}
function number(value: unknown, min: number, max: number) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw Error("Invalid content parameter");
  return value;
}
export function parseAsset(value: unknown): Asset {
  const a = object(value, ["path", "bytes", "sha256"]);
  if (
    !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:glb|wav|mp3|ogg)$/.test(
      str(a.path, 256),
    )
  )
    throw Error("Invalid asset path");
  if (!/^[a-f0-9]{64}$/.test(a.sha256)) throw Error("Invalid asset digest");
  number(a.bytes, 1, MAX_ASSET_BYTES);
  if (!Number.isInteger(a.bytes)) throw Error("Invalid asset size");
  return { path: a.path, bytes: a.bytes, sha256: a.sha256 };
}
export function parsePack(value: unknown): Pack {
  const p = object(value, [
    "schemaVersion",
    "sceneId",
    "revision",
    "engine",
    "model",
    "sound",
    "bindings",
    "parameters",
    "copy",
  ]);
  if (
    p.schemaVersion !== 1 ||
    p.sceneId !== "woodfish" ||
    p.engine !== "woodfish@1"
  )
    throw Error("Unsupported scene engine");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(str(p.revision, 80)))
    throw Error("Invalid scene revision");
  const model = parseAsset(p.model),
    sound = p.sound === undefined ? undefined : parseAsset(p.sound);
  if (
    !model.path.endsWith(".glb") ||
    (sound &&
      (!/\.(wav|mp3|ogg)$/.test(sound.path) || sound.bytes > 4 * 1024 * 1024))
  )
    throw Error("Invalid asset role");
  const b = object(p.bindings, ["body", "mallet"]),
    copy = object(p.copy, ["instruction"]);
  const raw = object(p.parameters, Object.keys(DEFAULT_PARAMETERS));
  const parameters = { ...DEFAULT_PARAMETERS };
  for (const key of [
    "exposure",
    "keyIntensity",
    "fillIntensity",
    "rimIntensity",
  ] as const)
    parameters[key] = number(raw[key], 0.1, 6);
  for (const key of ["liftMs", "strikeMs", "reboundMs", "settleMs"] as const)
    parameters[key] = number(raw[key], 60, 600);
  parameters.headRadius = number(raw.headRadius, 0.15, 0.4);
  if (!Array.isArray(raw.gripOffset) || raw.gripOffset.length !== 3)
    throw Error("Invalid grip");
  parameters.gripOffset = [
    number(raw.gripOffset[0], 0.3, 1),
    number(raw.gripOffset[1], -1.5, -0.5),
    number(raw.gripOffset[2], 0, 0.3),
  ];
  return {
    schemaVersion: 1,
    sceneId: "woodfish",
    engine: "woodfish@1",
    revision: str(p.revision, 80),
    model,
    ...(sound ? { sound } : {}),
    bindings: { body: str(b.body, 80), mallet: str(b.mallet, 80) },
    parameters,
    copy: { instruction: str(copy.instruction, 160) },
  };
}
export function verifyAsset(asset: Asset, bytes: ArrayBuffer) {
  if (bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.sha256)
    throw Error("Content integrity check failed");
}
export function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Content load cancelled", "AbortError");
}
export type ContentIO = {
  /** Never starts a network request. Missing/evicted/corrupt cache returns undefined. */
  readCachedAsset(
    asset: Asset,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer | undefined>;
  readManifest(url: string, signal?: AbortSignal): Promise<unknown>;
  readAsset(
    asset: Asset,
    url: string,
    signal?: AbortSignal,
    requireCache?: boolean,
  ): Promise<ArrayBuffer>;
  readHistory(key: string): Promise<unknown>;
  writeHistory(key: string, value: unknown): Promise<void>;
};
export type Candidate = { pack: Pack; base: string };
export type Lease<T> = { pack: Pack; value: T; confirm(): Promise<void> };
type Metadata = {
  version: 2;
  confirmed: Candidate[];
  pending?: Candidate;
  rejected: string[];
};
const identity = (candidate: Candidate) =>
  sha256(new TextEncoder().encode(JSON.stringify(candidate)).buffer);
function metadata(raw: unknown): Metadata {
  const value = raw as Partial<Metadata> | null;
  const parse = (entry: any): Candidate | undefined => {
    try {
      const base = new URL(entry.base);
      if (
        base.protocol !== "https:" &&
        !(
          base.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
        )
      )
        return;
      return { pack: parsePack(entry.pack), base: base.href };
    } catch {
      return;
    }
  };
  const old = Array.isArray(raw)
    ? raw
    : value?.version === 2 && Array.isArray(value.confirmed)
      ? value.confirmed
      : [];
  return {
    version: 2,
    confirmed: old.slice(0, 2).flatMap((c) => {
      const parsed = parse(c);
      return parsed ? [parsed] : [];
    }),
    pending: value?.version === 2 ? parse(value.pending) : undefined,
    rejected:
      value?.version === 2 && Array.isArray(value.rejected)
        ? value.rejected
            .filter((v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v))
            .slice(0, 8)
        : [],
  };
}
export function createContentClient(config: {
  io: ContentIO;
  bundled: Pack;
  bundledBase: string;
  manifestUrl?: string;
  validatePrepared?: (
    pack: Pack,
    model: ArrayBuffer,
    sound?: ArrayBuffer,
  ) => void;
}) {
  const { io } = config;
  const bundled = parsePack(config.bundled);
  const historyKey = `woodfish@1:${config.manifestUrl ?? "bundled"}`;
  let writes: Promise<unknown> = Promise.resolve();
  const readMetadata = async () =>
    metadata(await io.readHistory(historyKey).catch(() => undefined));
  const updateMetadata = (
    update: (value: Metadata) => void,
    signal?: AbortSignal,
  ) => {
    const pending = writes
      .catch(() => {})
      .then(async () => {
        checkAbort(signal);
        const value = await readMetadata();
        checkAbort(signal);
        update(value);
        await io.writeHistory(historyKey, value);
      });
    writes = pending;
    return pending;
  };
  let refreshing: { promise: Promise<void>; signal?: AbortSignal } | undefined;
  return {
    async prepareUpdate(options: { signal?: AbortSignal } = {}): Promise<void> {
      const { signal } = options;
      checkAbort(signal);
      if (!config.manifestUrl) return;
      if (refreshing && !refreshing.signal?.aborted) return refreshing.promise;
      const promise = (async () => {
        try {
          const url = new URL(config.manifestUrl!);
          if (
            url.protocol !== "https:" &&
            !(
              url.protocol === "http:" &&
              ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
            )
          )
            throw Error("Content endpoint requires HTTPS");
          const candidate = {
            pack: parsePack(await io.readManifest(url.href, signal)),
            base: new URL(".", url).href,
          };
          checkAbort(signal);
          if ((await readMetadata()).rejected.includes(identity(candidate)))
            return;
          const read = async (asset: Asset) => {
            const bytes = await io.readAsset(
              asset,
              new URL(asset.path, candidate.base).href,
              signal,
              true,
            );
            checkAbort(signal);
            verifyAsset(asset, bytes);
            return bytes;
          };
          const model = await read(candidate.pack.model);
          const sound = candidate.pack.sound
            ? await read(candidate.pack.sound)
            : undefined;
          checkAbort(signal);
          config.validatePrepared?.(candidate.pack, model, sound);
          await updateMetadata((state) => {
            if (state.rejected.includes(identity(candidate))) return;
            state.pending =
              state.confirmed[0] &&
              identity(state.confirmed[0]) === identity(candidate)
                ? undefined
                : candidate;
          }, signal);
        } catch {
          checkAbort(
            signal,
          ); /* Background errors never disturb the mounted scene. */
        }
      })();
      const job = { promise, signal };
      refreshing = job;
      try {
        await promise;
      } finally {
        if (refreshing === job) refreshing = undefined;
      }
    },
    async load<T>(
      initialize: (
        pack: Pack,
        model: ArrayBuffer,
        sound?: ArrayBuffer,
      ) => Promise<T>,
      options: { signal?: AbortSignal } = {},
    ): Promise<Lease<T>> {
      const { signal } = options;
      checkAbort(signal);
      const state = await readMetadata();
      const bootstrap = { pack: bundled, base: config.bundledBase };
      const candidates = [
        ...(state.pending ? [state.pending] : []),
        ...state.confirmed,
        bootstrap,
      ];
      let lastError: unknown;
      const tried = new Set<string>();
      for (const candidate of candidates) {
        checkAbort(signal);
        const id = identity(candidate);
        if (
          candidate !== bootstrap &&
          (tried.has(id) || state.rejected.includes(id))
        )
          continue;
        tried.add(id);
        const { pack, base } = candidate;
        let initializing = false;
        try {
          const read = async (asset: Asset) => {
            const bytes =
              candidate === bootstrap
                ? await io.readAsset(
                    asset,
                    new URL(asset.path, base).href,
                    signal,
                  )
                : await io.readCachedAsset(asset, signal);
            checkAbort(signal);
            if (!bytes) throw Error("Scene cache missing");
            verifyAsset(asset, bytes);
            return bytes;
          };
          // Sequential reads bound peak download/decode memory; no eager scene prefetch.
          const model = await read(pack.model);
          const sound = pack.sound ? await read(pack.sound) : undefined;
          checkAbort(signal);
          initializing = true;
          const value = await initialize(pack, model, sound);
          let confirmed = false;
          return {
            pack,
            value,
            async confirm() {
              if (confirmed || signal?.aborted || candidate === bootstrap)
                return;
              confirmed = true;
              // Only a rendered candidate becomes last known good; metadata errors
              // never turn a usable scene into a rendering failure.
              await updateMetadata((current) => {
                current.confirmed = [
                  candidate,
                  ...current.confirmed.filter((c) => identity(c) !== id),
                ].slice(0, 2);
                if (current.pending && identity(current.pending) === id)
                  current.pending = undefined;
                current.rejected = current.rejected.filter(
                  (rejected) => rejected !== id,
                );
              }, signal).catch(() => {});
            },
          };
        } catch (error) {
          checkAbort(signal);
          if (
            initializing &&
            candidate !== bootstrap &&
            error instanceof InvalidContentError
          ) {
            await updateMetadata((current) => {
              if (current.pending && identity(current.pending) === id)
                current.pending = undefined;
              current.rejected = [
                id,
                ...current.rejected.filter((rejected) => rejected !== id),
              ].slice(0, 8);
            }, signal).catch(() => {});
          }
          lastError = error;
        }
      }
      throw lastError ?? Error("No usable scene content");
    },
  };
}

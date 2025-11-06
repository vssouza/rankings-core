// test/wasm/index.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const saveGlobals = () => ({
  fetch: globalThis.fetch,
  instantiateStreaming: (WebAssembly as any).instantiateStreaming,
  compile: WebAssembly.compile,
  instantiate: WebAssembly.instantiate,
});

let originals = saveGlobals();

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  originals = saveGlobals();
});

afterEach(() => {
  // restore globals
  if (originals.fetch !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = originals.fetch;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).fetch;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (WebAssembly as any).instantiateStreaming = originals.instantiateStreaming;
  Object.defineProperty(WebAssembly, "compile", { value: originals.compile, configurable: true });
  Object.defineProperty(WebAssembly, "instantiate", { value: originals.instantiate, configurable: true });
});

describe("wasm/index init()", () => {
  it("uses streaming instantiation when available (fetch + WebAssembly.instantiateStreaming)", async () => {
    // Mock fetch returning a minimal 'Response-like' object
    vi.stubGlobal("fetch", vi.fn(async (_url: any) => ({
      ok: true,
      // not needed by streaming path, but be robust
      arrayBuffer: async () => new ArrayBuffer(8),
    })));

    // Mock instantiateStreaming to return an instance with exports
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (WebAssembly as any).instantiateStreaming = vi.fn(async (_res: any, _imports: any) => ({
      instance: { exports: { add: (a: number, b: number) => a + b } },
    }));

    const mod = await import("../../wasm/index");
    const exports = await mod.init();
    expect(typeof exports).toBe("object");
    // @ts-ignore - our fake export
    expect(typeof exports.add).toBe("function");
    // @ts-ignore
    expect(exports.add(2, 3)).toBe(5);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(WebAssembly.instantiateStreaming).toHaveBeenCalledTimes(1);
  });

  it("falls back to bytes path when instantiateStreaming is not available", async () => {
    // Provide fetch but remove instantiateStreaming
    vi.stubGlobal("fetch", vi.fn(async (_url: any) => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (WebAssembly as any).instantiateStreaming = undefined;

    // Stub compile & instantiate for bytes path
    const compileSpy = vi.spyOn(WebAssembly, "compile").mockResolvedValue({} as unknown as WebAssembly.Module);
    const instantiateSpy = vi
      .spyOn(WebAssembly, "instantiate")
      // when given a Module, returns an Instance
      .mockResolvedValue({ exports: { ping: () => 42 } } as unknown as WebAssembly.Instance);

    const mod = await import("../../wasm/index");
    const exports = await mod.init();
    expect(typeof exports).toBe("object");
    // @ts-ignore - fake export
    expect(exports.ping()).toBe(42);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(compileSpy).toHaveBeenCalledTimes(1);
    expect(instantiateSpy).toHaveBeenCalledTimes(1);
  });

  it("uses Node file path when fetch is not defined (reads from node:fs/promises)", async () => {
    // Remove fetch to force Node path
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).fetch;

    // Mock node:fs/promises readFile to return a Buffer-like object
    vi.doMock("node:fs/promises", () => ({
      readFile: vi.fn(async (_url: any) => Buffer.from([0x00, 0x61, 0x73, 0x6d])), // "\0asm" header prefix
    }));

    // Stub compile & instantiate for bytes path
    const compileSpy = vi.spyOn(WebAssembly, "compile").mockResolvedValue({} as unknown as WebAssembly.Module);
    const instantiateSpy = vi
      .spyOn(WebAssembly, "instantiate")
      .mockResolvedValue({ exports: { ok: true } } as unknown as WebAssembly.Instance);

    const mod = await import("../../wasm/index");
    const exports = await mod.init();
    expect(exports).toBeDefined();
    // @ts-ignore - our fake export
    expect(exports.ok).toBe(true);

    expect(compileSpy).toHaveBeenCalledTimes(1);
    expect(instantiateSpy).toHaveBeenCalledTimes(1);
  });
});

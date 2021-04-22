import * as path from "path";
import * as esbuild from "esbuild";

import * as cache from "../cache";
import type { RemixConfig } from "../config";
import { getFileHash } from "./utils/crypto";

type CachedRouteExports = { hash: string; exports: string[] };

export async function getRouteModuleExportsCached(
  config: RemixConfig,
  routeId: string
): Promise<string[]> {
  let file = path.resolve(config.appDirectory, config.routes[routeId].file);
  let hash = await getFileHash(file);
  let key = routeId + ".exports";

  let cached: CachedRouteExports | null = null;
  try {
    cached = await cache.getJson(config.cacheDirectory, key);
  } catch (error) {
    // Ignore cache read errors.
  }

  if (!cached || cached.hash !== hash) {
    let exports = await getRouteModuleExports(config, routeId);
    cached = { hash, exports };
    try {
      await cache.putJson(config.cacheDirectory, key, cached);
    } catch (error) {
      // Ignore cache put errors.
    }
  }

  return cached.exports;
}

export async function getRouteModuleExports(
  config: RemixConfig,
  routeId: string
): Promise<string[]> {
  let result = await esbuild.build({
    entryPoints: [
      path.resolve(config.appDirectory, config.routes[routeId].file)
    ],
    platform: "neutral",
    format: "esm",
    metafile: true,
    write: false
  });
  let metafile = result.metafile!;

  for (let key in metafile.outputs) {
    let output = metafile.outputs[key];
    if (output.entryPoint) return output.exports;
  }

  throw new Error(`Unable to get exports for route ${routeId}`);
}
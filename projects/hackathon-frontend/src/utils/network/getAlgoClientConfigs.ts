// src/utils/network/getAlgoClientConfigs.ts
import { AlgoViteClientConfig, AlgoViteKMDConfig } from "../../interfaces/network";

/**
 * Read a Vite env var or return undefined if empty.
 */
function env(key: string): string | undefined {
  const v = (import.meta.env as any)[key];
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

/**
 * Map/normalize the requested network to an id the rest of the app understands.
 * Supports both VITE_ALGOD_NETWORK and VITE_NETWORK. Falls back to localnet.
 */
function getRequestedNetwork(): "localnet" | "testnet" | "mainnet" {
  const n = (env("VITE_ALGOD_NETWORK") || env("VITE_NETWORK") || "LOCALNET").toLowerCase();

  if (n === "localnet") return "localnet";
  if (n === "testnet") return "testnet";
  if (n === "mainnet") return "mainnet";

  // default safely to localnet during development
  return "localnet";
}

/**
 * Parse a port environment variable to number; return undefined if not set.
 */
function parsePort(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Algod (node) config from env with solid defaults for LocalNet.
 * For testnet/mainnet you can either:
 *  - keep using env-based host/port/token (as done here), or
 *  - hardcode provider URLs if you prefer (Algonode, etc.).
 */
export function getAlgodConfigFromViteEnvironment(): AlgoViteClientConfig {
  const network = getRequestedNetwork();

  // Defaults for LocalNet (Docker via AlgoKit)
  const defaultLocalnet: AlgoViteClientConfig = {
    server: "http://localhost",
    port: 4001,
    token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    network: "localnet",
  };

  // Read env if present; otherwise fall back (esp. in localnet)
  const server = env("VITE_ALGOD_SERVER");
  const port = parsePort(env("VITE_ALGOD_PORT"));
  const token = env("VITE_ALGOD_TOKEN");

  if (network === "localnet") {
    return {
      server: server ?? defaultLocalnet.server,
      port: port ?? defaultLocalnet.port,
      token: token ?? defaultLocalnet.token,
      network,
    };
  }

  // For testnet/mainnet we still allow env to drive the values.
  // If you prefer provider defaults, set them here when server/port are missing.
  if (!server) {
    throw new Error("VITE_ALGOD_SERVER is required for non-localnet networks (testnet/mainnet)");
  }

  return {
    server,
    port: port, // may be undefined for https endpoints that don't need it
    token: token ?? "",
    network,
  };
}

/**
 * Indexer config from env with LocalNet defaults.
 */
export function getIndexerConfigFromViteEnvironment(): AlgoViteClientConfig {
  const network = getRequestedNetwork();

  const defaultLocalnet: AlgoViteClientConfig = {
    server: "http://localhost",
    port: 8980,
    token: "",
    network: "localnet",
  };

  const server = env("VITE_INDEXER_SERVER");
  const port = parsePort(env("VITE_INDEXER_PORT"));
  const token = env("VITE_INDEXER_TOKEN");

  if (network === "localnet") {
    return {
      server: server ?? defaultLocalnet.server,
      port: port ?? defaultLocalnet.port,
      token: token ?? defaultLocalnet.token,
      network,
    };
  }

  if (!server) {
    throw new Error("VITE_INDEXER_SERVER is required for non-localnet networks (testnet/mainnet)");
  }

  return {
    server,
    port: port,
    token: token ?? "",
    network,
  };
}

/**
 * KMD config for LocalNet. KMD runs on 4002 by default in AlgoKit LocalNet.
 * If you explicitly set VITE_KMD_* they will override the defaults.
 */
export function getKmdConfigFromViteEnvironment(): AlgoViteKMDConfig {
  const server = env("VITE_KMD_SERVER") || env("VITE_ALGOD_SERVER") || "http://localhost";
  const port = parsePort(env("VITE_KMD_PORT")) ?? 4002;
  const token = env("VITE_KMD_TOKEN") || env("VITE_ALGOD_TOKEN") || "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  const wallet = env("VITE_KMD_WALLET") || ""; // optional
  const password = env("VITE_KMD_PASSWORD") || ""; // optional

  return { server, port, token, wallet, password };
}

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["tests/browser/panel.html", "tests/browser/popup.html"];
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "chromium",
  "chromium-browser",
  "google-chrome",
  "google-chrome-stable",
].filter(Boolean);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate.includes(path.sep) && existsSync(candidate)) {
      return candidate;
    }

    const probe = spawnSync("which", [candidate], { encoding: "utf8" });
    if (probe.status === 0) {
      return probe.stdout.trim();
    }
  }

  return null;
}

function startServer() {
  const server = createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url || "/", "http://127.0.0.1").pathname
      );
      let filePath = path.resolve(ROOT, `.${pathname}`);
      if (!filePath.startsWith(`${ROOT}${path.sep}`) && filePath !== ROOT) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      if (statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      const body = readFileSync(filePath);
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

function extractResults(html) {
  const match = html.match(/<pre id="results"[^>]*>([\s\S]*?)<\/pre>/);
  return match ? match[1].trim() : "";
}

function runChrome(chrome, args) {
  return new Promise((resolve) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 45000);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < 20 * 1024 * 1024) {
        stdout += chunk.toString();
      }
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4 * 1024 * 1024) {
        stderr += chunk.toString();
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr, error, timedOut });
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr, timedOut });
    });
  });
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error("No Chromium/Chrome found. Set CHROME_PATH to run browser tests.");
    process.exitCode = 1;
    return;
  }

  const { server, port } = await startServer();
  let failed = false;

  try {
    for (const page of PAGES) {
      const profile = mkdtempSync(path.join(tmpdir(), "docutype-chrome-"));
      const url = `http://127.0.0.1:${port}/${page.replace(/^\//, "")}`;
      console.log(`\n▶ ${page}`);

      const result = await runChrome(chrome, [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
        "--disable-default-apps",
        "--disable-extensions",
        "--metrics-recording-only",
        `--user-data-dir=${profile}`,
        "--virtual-time-budget=30000",
        "--dump-dom",
        url,
      ]);

      const output = `${result.stdout || ""}${result.stderr || ""}`;
      const results = extractResults(result.stdout || "");
      const passed =
        result.status === 0 &&
        results.includes("BROWSER TESTS PASSED") &&
        !results.includes("BROWSER TESTS FAILED");

      if (passed) {
        console.log(results);
      } else {
        failed = true;
        console.error(results || output.slice(-5000) || "Browser harness produced no output.");
        if (result.error) {
          console.error(result.error.message);
        }
        if (result.timedOut) {
          console.error("Chromium timed out.");
        }
        if (result.stderr && !results) {
          console.error(result.stderr.slice(-3000));
        }
      }

      rmSync(profile, { recursive: true, force: true });
    }
  } finally {
    server.close();
  }

  if (failed) {
    console.error("\nBrowser tests failed.");
    process.exitCode = 1;
  } else {
    console.log("\nBrowser tests passed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

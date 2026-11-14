// src/routes/docs.ts
import express, {Request, Response} from "express";
import fs from "node:fs";
import path from "node:path";

/**
 * Resolves the OpenAPI contract location. The file lives at the
 * repository root in development and is copied next to the compiled
 * output in production images.
 */
function resolveSpecPath(): string {
    const candidates = [
        path.resolve(process.cwd(), "docs", "openapi.yaml"),
        path.resolve(__dirname, "..", "..", "docs", "openapi.yaml"),
        path.resolve(__dirname, "..", "..", "..", "docs", "openapi.yaml"),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return candidates[0];
}

const SPEC_PATH = resolveSpecPath();

/*
 * Swagger UI is loaded from a CDN, but the version is pinned and every
 * asset carries a Subresource Integrity hash. A compromised CDN (or a
 * malicious release published under the floating `@5` range) therefore
 * cannot execute arbitrary JavaScript on the API origin.
 *
 * The hashes are SHA-384 digests of the `swagger-ui-dist@5.35.0` files.
 */
const SWAGGER_UI_VERSION = "5.35.0";
const SWAGGER_UI_BASE =
    `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

const SWAGGER_UI_CSS_SRI =
    "sha384-WlYgdmXYOOBWL5apwjDEZwN+U3HmXSSu5R6V5aGxEcf7z+KuRNwBhoxKVN1i3D5I";
const SWAGGER_UI_BUNDLE_SRI =
    "sha384-gjRm0bEPMeTmMh5jT2cHccIwCUZSTd8YC+j0d0sXw0MdGEfScduGpSyF3ZSSLkX9";
const SWAGGER_UI_PRESET_SRI =
    "sha384-My2aDM4r2Mbm3ybHcubKm9O9U8FEjvF/O5nGvE9YK5dzqOTbWEKa79RPJ1krdMaF";

/*
 * The bootstrap lives in its own same-origin script so the page does
 * not need `script-src 'unsafe-inline'`.
 */
const SWAGGER_UI_INIT = `window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: "/openapi.yaml",
    dom_id: "#swagger-ui",
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "StandaloneLayout",
  });
};
`;

export default () => {
    const router = express.Router();

    const serveSpec = (_req: Request, res: Response) => {
        if (!fs.existsSync(SPEC_PATH)) {
            res.status(404).json({code: "DATA_NOT_FOUND"});
            return;
        }

        res.type("text/yaml");
        res.sendFile(SPEC_PATH);
    };

    router.get("/openapi.yaml", serveSpec);
    router.get("/docs/openapi.yaml", serveSpec);

    router.get("/openapi.json", (_req: Request, res: Response) => {
        if (!fs.existsSync(SPEC_PATH)) {
            res.status(404).json({code: "DATA_NOT_FOUND"});
            return;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const yaml = require("js-yaml");
            const parsed = yaml.load(
                fs.readFileSync(SPEC_PATH, "utf-8"),
            );
            res.json(parsed);
        } catch {
            res.type("text/yaml");
            res.sendFile(SPEC_PATH);
        }
    });

    router.get("/swagger-ui-init.js", (_req: Request, res: Response) => {
        res.type("application/javascript").send(SWAGGER_UI_INIT);
    });

    router.get(["/api-docs", "/swagger"], (_req: Request, res: Response) => {
        /*
         * The page loads pinned, integrity-checked Swagger UI assets
         * from the CDN and its bootstrap from the same origin, so the
         * global Helmet CSP only needs to allow the CDN origins. Inline
         * styles remain allowed because Swagger UI applies them at
         * runtime.
         */
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self' https://unpkg.com; " +
                "script-src 'self' https://unpkg.com; " +
                "style-src 'self' 'unsafe-inline' https://unpkg.com; " +
                "img-src 'self' data: https://unpkg.com; " +
                "font-src 'self' https://unpkg.com; " +
                "connect-src 'self' https://unpkg.com;",
        );
        res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Express API Boilerplate - Swagger UI</title>
  <link
    rel="stylesheet"
    href="${SWAGGER_UI_BASE}/swagger-ui.css"
    integrity="${SWAGGER_UI_CSS_SRI}"
    crossorigin="anonymous"
  />
</head>
<body>
  <div id="swagger-ui"></div>
  <script
    src="${SWAGGER_UI_BASE}/swagger-ui-bundle.js"
    integrity="${SWAGGER_UI_BUNDLE_SRI}"
    crossorigin="anonymous"
  ></script>
  <script
    src="${SWAGGER_UI_BASE}/swagger-ui-standalone-preset.js"
    integrity="${SWAGGER_UI_PRESET_SRI}"
    crossorigin="anonymous"
  ></script>
  <script src="/swagger-ui-init.js"></script>
</body>
</html>`);
    });

    router.get("/docs", (_req: Request, res: Response) => {
        res.redirect(302, "/api-docs");
    });

    return router;
};

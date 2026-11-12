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

    router.get(["/api-docs", "/swagger"], (_req: Request, res: Response) => {
        // The page loads Swagger UI from a CDN and uses an inline
        // bootstrap script, so the global Helmet CSP (default-src 'none')
        // would otherwise blank the page.
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self' https://unpkg.com; " +
                "script-src 'self' 'unsafe-inline' https://unpkg.com; " +
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
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/openapi.yaml",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
      });
    };
  </script>
</body>
</html>`);
    });

    router.get("/docs", (_req: Request, res: Response) => {
        res.redirect(302, "/api-docs");
    });

    return router;
};
import express from "express";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import useragent from 'express-useragent';
import compression from "compression";
import {logger} from "./configurations/logger";
import v1 from "./http/routes/v1";
import {__ENV} from "./configurations/env";
import {DatabaseMiddleware} from "./http/middlewares/database.middleware";
import os from "os";
import cluster from "node:cluster";
import errors from "./configurations/errors";

const app = express();

// middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// basic security middleware
app.use(helmet());
app.use(hpp());
app.disable('x-powered-by');
app.use(useragent.express());
app.use(cors());

// compress response
app.use(compression({
    filter: function (req: express.Request, res: express.Response) {
        // don't compress responses with this request header
        if (req.headers['x-no-compression']) return false;

        // fallback to standard filter function
        return compression.filter(req, res);
    },
}));

// logging
app.use((req: any, res: any, next: any) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// custom middleware
DatabaseMiddleware(app);

// routes with versioning
app.use("/api/v1", v1());

// handle 404 - Not Found
app.use((_req: express.Request, res: express.Response) => {
    res.status(404).json({code: errors.e14.code, message: errors.e14.message});
});

// error handling
app.use((err: any, _req: any, res: any) => {
    logger.error(err.message);
    res.status(500).json({code: errors.e4.code, message: errors.e4.message});
});

// run the server
let clusterWorkerSize = os.cpus().length;
if (clusterWorkerSize > 1 && __ENV.CLUSTER) {
    if (cluster.isPrimary) {
        for (let i = 0; i < clusterWorkerSize; i++) {
            cluster.fork();
        }

        cluster.on('exit', function (worker: any) {
            logger.info('Worker', worker.id, ' has exited.');
        });
    } else {
        app.listen(__ENV.PORT, () => {
            logger.info(`⚡️[server local]: Server is running at http://localhost:${__ENV.PORT}`);
            logger.info(`⚡️[server expose]: Server is running at http://localhost:${__ENV.PORT_EXPOSE}`);
        });
    }
} else {
    app.listen(__ENV.PORT, () => {
        logger.info(`⚡️No cluster is enabled: ${clusterWorkerSize}`);
        logger.info(`⚡️[server local]: Server is running at http://localhost:${__ENV.PORT}`);
        logger.info(`⚡️[server expose]: Server is running at http://localhost:${__ENV.PORT_EXPOSE}`);
    });
}

export default app;
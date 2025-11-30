import express, {NextFunction, Request, Response} from "express";
import os from "os";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import v1 from "./http/routes/v1";
import {express as useragent} from "express-useragent";
import compression from "compression";
import {logger} from "./configurations/logger";
import {__ENV} from "./configurations/environment";
import cluster from "node:cluster";
import errors from "./configurations/errors";
import {DBKnex} from "./configurations/knex";
import {DBRedis} from "./configurations/redis";
import {SET_CACHE_SETTINGS} from "./models/setting.model";
import {SET_CACHE_GUARDS} from "./models/route-guard.model";
import REQUEST_MIDDLEWARE from "./http/middlewares/request.middleware";
import SettingService from "./services/setting.service";
import RouteGuardService from "./services/route-guard.service";
import RedisSubscriberService from "./services/redis-subscriber.service";
import RedisEventService from "./services/redis-event.service";

const app = express();

// middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// basic security middleware
app.use(helmet());
app.use(hpp());
app.disable("x-powered-by");
app.use(useragent());
app.use(cors());

// enable trust proxy to get correct IP when behind a proxy
if (__ENV.HAS_PROXY) app.set("trust proxy", true);

// compress response
app.use(compression({
    filter: function (req: express.Request, res: express.Response) {
        // don't compress responses with this request header
        if (req.headers["x-no-compression"]) return false;

        // fallback to standard filter function
        return compression.filter(req, res);
    },
}));

// logging
app.use((req: any, res: any, next: any) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// custom middlewares
app.use(REQUEST_MIDDLEWARE);

// cache application settings and route guards
SettingService.boot().then(() => logger.info("Setting Cached"));
RouteGuardService.boot().then(() => logger.info("Route Guard Cached"));

// subscribe to redis events
RedisSubscriberService.subscribe(SET_CACHE_SETTINGS);
RedisSubscriberService.subscribe(SET_CACHE_GUARDS);

// received redis events
RedisEventService.onReceived();

// routes with versioning
app.use("/api/v1", v1());

// handle 404 - Not Found
app.use((_req: express.Request, res: express.Response) => {
    res.status(404).json({code: errors.DATA_NOT_FOUND.code, message: errors.DATA_NOT_FOUND.message});
});

// error handling
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    logger.error(`${errors.SERVER_ERROR.message}, ${err.message}`);

    res.status(err.status || 500).json({
        code: errors.SERVER_ERROR.code,
        message: __ENV.NODE_ENV === "production" ? errors.SERVER_ERROR.message : err.message,
    });
});

// run the server
const CLUSTER_SIZE_WORKER = os.cpus().length;
if (CLUSTER_SIZE_WORKER > 1 && __ENV.CLUSTER) {
    if (cluster.isPrimary) {
        for (let i = 0; i < CLUSTER_SIZE_WORKER; i++) {
            cluster.fork();
        }

        cluster.on("exit", function (worker: any) {
            logger.info("Worker", worker.id, " has exited.");
        });
    } else {
        app.listen(__ENV.PORT, () => {
            logger.info(`⚡️ [server local]: Server is running at http://localhost:${__ENV.PORT}`);
            logger.info(`⚡️ [server expose]: Server is running at http://localhost:${__ENV.PORT_EXPOSE}`);
        });
    }
} else {
    app.listen(__ENV.PORT, () => {
        logger.info(`⚡️ No cluster is enabled: ${CLUSTER_SIZE_WORKER}`);
        logger.info(`⚡️ [server local]: Server is running at http://localhost:${__ENV.PORT}`);
        logger.info(`⚡️ [server expose]: Server is running at http://localhost:${__ENV.PORT_EXPOSE}`);
    });
}

// Gracefully handle SIGINT (Ctrl+C) to close DB connections
process.on("SIGINT", async () => {
    logger.info("Received SIGINT, closing DB connections...");

    try {
        if (DBKnex) {
            await DBKnex.destroy();
            logger.info("Knex connection closed");
        }

        if (DBRedis) {
            if (DBRedis.publisher) await DBRedis.publisher.quit();
            if (DBRedis.subscriber) await DBRedis.subscriber.quit();
            logger.info("Redis connection closed");
        }
    } catch (err: any) {
        logger.error(`Error while closing connections: ${err.message}`);
    } finally {
        // Exit the process
        process.exit(0);
    }
});

export default app;
import express from "express";
import os from "os";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import v1 from "./http/routes/v1";
import useragent from "express-useragent";
import compression from "compression";
import {logger} from "./configurations/logger";
import {__ENV} from "./configurations/environment";
import cluster from "node:cluster";
import errors from "./configurations/errors";
import {DBKnex} from "./configurations/knex";
import {DBRedis} from "./configurations/redis";
import requestMiddleware from "./http/middlewares/request.middleware";
import {RedisSubscriberService} from "./services/redis/redis-subscriber.service";
import {RedisEventService} from "./services/redis/redis-event.service";
import {CACHE_SETT_NAME, InitializerSettingInterface, SettingModel} from "./models/setting.model";
import {CACHE_GUARD_NAME, RouteGuardModel} from "./models/route-guard.model";

const app = express();

// middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// basic security middleware
app.use(helmet());
app.use(hpp());
app.disable("x-powered-by");
app.use(useragent.express());
app.use(cors());

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

// set database connection
app.set("knex", DBKnex);
app.set("redis", DBRedis);

// custom middlewares
app.use(requestMiddleware);

// cache application settings and route guards
SettingModel(DBKnex).initializer().then((keyValues: InitializerSettingInterface) => app.set(CACHE_SETT_NAME, (): Readonly<InitializerSettingInterface> => Object.freeze(keyValues)));
RouteGuardModel(DBKnex).initializer().then((guards: Record<string, string[]>) => app.set(CACHE_GUARD_NAME, (): Readonly<Record<string, string[]>> => Object.freeze(guards)));

// subscribe to redis events
RedisSubscriberService(CACHE_SETT_NAME);
RedisSubscriberService(CACHE_GUARD_NAME);
RedisEventService();

// routes with versioning
app.use("/api/v1", v1());

// handle 404 - Not Found
app.use((_req: express.Request, res: express.Response) => {
    res.status(404).json({code: errors.DATA_NOT_FOUND.code, message: errors.DATA_NOT_FOUND.message});
});

// error handling
app.use((err: any, _req: any, res: any) => {
    logger.error(err.message);
    res.status(500).json({code: errors.SERVER_ERROR.code, message: errors.SERVER_ERROR.message});
});

// run the server
let clusterWorkerSize = os.cpus().length;
if (clusterWorkerSize > 1 && __ENV.CLUSTER) {
    if (cluster.isPrimary) {
        for (let i = 0; i < clusterWorkerSize; i++) {
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
        logger.info(`⚡️ No cluster is enabled: ${clusterWorkerSize}`);
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
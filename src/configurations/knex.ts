import fs from "fs";
import Knex from "knex";
import {__ENV} from "./environment";
import {logger} from "./logger";

const CONFIG: any = {
    client: __ENV.DB_CLIENT,
    connection: {
        host: __ENV.DB_HOST,
        port: __ENV.DB_PORT,
        user: __ENV.DB_USER,
        password: __ENV.DB_PASS,
        database: __ENV.DB_NAME,
        charset: __ENV.DB_CHARSET,
        dateStrings: __ENV.DB_DATE_STRING,
    },
    pool: {min: __ENV.DB_POOL_MIN, max: __ENV.DB_POOL_MAX},
};

// set SSL connection support
if (__ENV.DB_SSL) {
    CONFIG.connection.ssl = {
        ca: fs.readFileSync(__ENV.DB_SSL_CA).toString(),
        cert: fs.readFileSync(__ENV.DB_SSL_CERT).toString(),
        key: fs.readFileSync(__ENV.DB_SSL_KEY).toString(),
    };
}

const CONNECTION = Knex(CONFIG);

async function checkConnection() {
    try {
        // Perform a simple query to check connection
        await CONNECTION.raw("SELECT 1+1 AS result");
    } catch (error) {
        logger.error(`Knex failed to connect to the database: ${error}`);
    }
}

// Connection checker
checkConnection().then(() => {
    logger.info("🤝 Connected to the database (KNEX)");
});

// Handle global error events
CONNECTION.on("query-error", (error, obj) => {
    logger.error(`Knex Query Error: ${error.message}`);
    logger.error(`Knex Query Details: ${obj.sql}`);
});

CONNECTION.on("error", (error) => {
    logger.error(`Knex Global Error: ${error.message}`);
});

export const DBKnex = CONNECTION;
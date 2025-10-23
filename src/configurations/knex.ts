import fs from "fs";
import Knex from "knex";
import {__ENV} from "./environment";

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

export const DBKnex = Knex(CONFIG);
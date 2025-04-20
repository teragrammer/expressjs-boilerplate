import {Knex} from 'knex';
import dotenv from 'dotenv';
import * as path from "node:path";
import {__ENV} from "./src/configurations/env";

dotenv.config();

const config: { [key: string]: Knex.Config } = {
    development: {
        client: __ENV.DB_CLIENT,
        connection: {
            host: __ENV.DB_HOST,
            database: __ENV.DB_NAME,
            user: __ENV.DB_USER,
            password: __ENV.DB_PASS,
            charset: __ENV.DB_CHARSET,
            dateStrings: __ENV.DB_DATE_STRING,
        },
        pool: {
            min: __ENV.DB_POOL_MIN,
            max: __ENV.DB_POOL_MAX,
        },
        migrations: {
            directory: path.join(__dirname, 'database', 'migrations'),
            extension: 'ts',
        },
        seeds: {
            directory: path.join(__dirname, 'database', 'seeds'),
            extension: 'ts',
        },
    },
    staging: {
        client: __ENV.DB_CLIENT,
        connection: {
            host: __ENV.DB_HOST,
            database: __ENV.DB_NAME,
            user: __ENV.DB_USER,
            password: __ENV.DB_PASS,
            charset: __ENV.DB_CHARSET,
            dateStrings: __ENV.DB_DATE_STRING,
        },
        pool: {
            min: __ENV.DB_POOL_MIN,
            max: __ENV.DB_POOL_MAX,
        },
        migrations: {
            directory: path.join(__dirname, 'database', 'migrations'),
            extension: 'ts',
        },
        seeds: {
            directory: path.join(__dirname, 'database', 'seeds'),
            extension: 'ts',
        },
    },
    production: {
        client: __ENV.DB_CLIENT,
        connection: {
            host: __ENV.DB_HOST,
            database: __ENV.DB_NAME,
            user: __ENV.DB_USER,
            password: __ENV.DB_PASS,
            charset: __ENV.DB_CHARSET,
            dateStrings: __ENV.DB_DATE_STRING,
        },
        pool: {
            min: __ENV.DB_POOL_MIN,
            max: __ENV.DB_POOL_MAX,
        },
        migrations: {
            directory: path.join(__dirname, 'database', 'migrations'),
            extension: 'ts',
        },
        seeds: {
            directory: path.join(__dirname, 'database', 'seeds'),
            extension: 'ts',
        },
    },
};

export default config;

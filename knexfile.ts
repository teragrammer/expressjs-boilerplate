import { Knex } from "knex";
import fs from "fs";
import dotenv from "dotenv";
import * as path from "node:path";
import { __ENV } from "./src/configurations/env";

dotenv.config();

const DEVELOPMENT: any = {
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
    directory: path.join(__dirname, "database", "migrations"),
    extension: "ts",
  },
  seeds: {
    directory: path.join(__dirname, "database", "seeds"),
    extension: "ts",
  },
};

const STAGING: any = {
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
    directory: path.join(__dirname, "database", "migrations"),
    extension: "ts",
  },
  seeds: {
    directory: path.join(__dirname, "database", "seeds"),
    extension: "ts",
  },
};

const PRODUCTION: any = {
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
    directory: path.join(__dirname, "database", "migrations"),
    extension: "ts",
  },
  seeds: {
    directory: path.join(__dirname, "database", "seeds"),
    extension: "ts",
  },
};

if (__ENV.DB_SSL) {
  DEVELOPMENT.connection.ssl = {
    ca: fs.readFileSync(__ENV.DB_SSL_CA).toString(),
    cert: fs.readFileSync(__ENV.DB_SSL_CERT).toString(),
    key: fs.readFileSync(__ENV.DB_SSL_KEY).toString(),
  };
  
  STAGING.connection.ssl = {
    ca: fs.readFileSync(__ENV.DB_SSL_CA).toString(),
    cert: fs.readFileSync(__ENV.DB_SSL_CERT).toString(),
    key: fs.readFileSync(__ENV.DB_SSL_KEY).toString(),
  };

  PRODUCTION.connection.ssl = {
    ca: fs.readFileSync(__ENV.DB_SSL_CA).toString(),
    cert: fs.readFileSync(__ENV.DB_SSL_CERT).toString(),
    key: fs.readFileSync(__ENV.DB_SSL_KEY).toString(),
  };
}

const config: { [key: string]: Knex.Config } = {
  development: DEVELOPMENT,
  staging: STAGING,
  production: PRODUCTION,
};

export default config;

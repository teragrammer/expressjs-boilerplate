import {Express} from 'express';
import Knex from 'knex';
import {__ENV} from "../../configurations/env";

export function DatabaseMiddleware(app: Express) {
    app.knex = Knex({
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
    });

    app.paginate = (req: any) => {
        let perPage = req.query.per_page || 10;
        let page = req.query.page || 1;

        if (isNaN(perPage)) perPage = 10;
        if (isNaN(page)) page = 1;

        if (page < 1) page = 1;
        let offset = (page - 1) * perPage;

        return {
            offset,
            perPage,
        };
    };
}
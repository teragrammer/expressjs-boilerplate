import {NextFunction, Request, Response} from "express";

const requestMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // pagination helper
    req.app.set("paginate", () => {
        let perPage: any = req.query.per_page || 10;
        let page: any = req.query.page || 1;

        if (isNaN(perPage)) perPage = 10;
        if (isNaN(page)) page = 1;

        if (page < 1) page = 1;
        let offset = (page - 1) * perPage;

        return {
            offset,
            perPage,
        };
    });

    next();
};

export default requestMiddleware;
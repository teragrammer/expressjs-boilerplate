import {NextFunction, Request, Response} from "express";

const catchAsync = (fn: any) => (req: Request, res: Response, next: NextFunction): any => {
    fn(req, res, next).catch(next);
};

export default catchAsync;
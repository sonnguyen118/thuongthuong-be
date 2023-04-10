import express, { Request, Response, NextFunction } from "express";
import compression from "compression";
import bodyParser from "body-parser";
import httpStatus from "http-status";
import lusca from "lusca";
import flash from "express-flash";
import mongoose from "mongoose";
import passport from "passport";
import config from "./config";
import { errorHandler, errorConverter } from "@midlewares/error";
import apiRouter from "./controllers/api";
import logger from "./config/logger";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger/swaggerJsDoc";
import {customerStrategy, staffStrategy, internalStrategy, staffStrategyWithoutRole} from "@config/passport";
import { healthCheck } from "./util";
import toJSON from "./util/toJSON";
import cors from "cors";
import cookieParser from "cookie-parser";
import Sentry from "@config/Sentry";

// Create Express server
const app = express();

// Connect to MongoDB
mongoose.set("debug", process.env.NODE_ENV !== "production");
mongoose.connect(config.mongoose.url, config.mongoose.option ).then(
    () => { logger.info("MongoDB connected!"); },
).catch((err: Error) => {
    logger.error(`MongoDB connection error. Please make sure MongoDB is running. ${err}`);
});

// MongoDB plugins
mongoose.plugin(toJSON);

// registered model mongoDb
import "./models/mongo/ProductTagModel";
import "./models/mongo/OrderTagModel";
import "./models/mongo/UserModel";
import "./models/mongo/OrderModel";
import "./models/mongo/ProductModel";
import "./models/mongo/RelatedProducts";
import "./models/mongo/SellerProcessResultModel";
import "./models/mongo/InventoryModel";
import "./models/mongo/CustomerAddressModel";
import "./models/mongo/BlogCategoryModel";
import "./models/mongo/RedirectConfigModel";
import "./models/mongo/SettingModel";

// Express configuration
app.set("port", process.env.PORT || 3000);

app.use(Sentry.Handlers.requestHandler({
    serverName: true,
    transaction: "methodPath"
}));
app.use(morgan("combined"));
app.use(compression());

const rawBodySaver =  (req: any, res: Response, buf: any, encoding: any) =>{
    if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || "utf8");
    }
};

const options = {
    verify: rawBodySaver
};

app.use(bodyParser.json(options));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());
passport.use("jwtCustomer", customerStrategy);
passport.use("jwtStaff", staffStrategy);
passport.use("masterKey", internalStrategy);
passport.use("jwtStaffWithoutRole", staffStrategyWithoutRole);

app.use(flash());
app.use(lusca.xframe("SAMEORIGIN"));
app.use(lusca.xssProtection(true));

const origins: string[] = [
    "http://localhost:3002",
    "http://localhost:3000",
    "https://shop.30shine.org",
    "https://store.30shine.org",
    "http://store-dev.30shine.org",
    "https://shop-std.30shine.com",
    "https://shop.30shine.com",
    "https://shop-app.30shine.com",
    "https://admin-shop-std.30shine.com",
    "https://std-admin-shop.30shine.com",
    "https://admin-shop.30shine.com",
    "https://admin-store.30shine.org",
    "http://customer.30shine.org",
    "https://customer.30shine.com",
    "https://std-customer.30shine.com",
    "http://customer-test-2.30shine.org",
    "http://customer-test-1.30shine.org",
    "https://std.30shine.com",
    "https://30shine.com",
    "https://v3.30shine.org",
    "https://webv3-apibookingv3.30shine.org",
    "http://localhost:8080",
    "https://inventory-test.30shine.org",
    "https://std-inventory.30shine.com",
    "https://inventory.30shine.com",
];

const corsOption = {
    origin: origins,
    credentials: true
};

app.use(cors(corsOption));
app.options("*", cors(corsOption));

app.get("/", (req: Request, res: Response) => {
    if (healthCheck()) {
        res.status(httpStatus.OK).json({ status: "UP" });
    } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: "DOWN" });
    }
});

/**
 * Swagger API docs config
 */
app.use("/api-docs",swaggerUi.serve, swaggerUi.setup(swaggerDocument));

/**
 * Primary api routes.
 */
app.use("/api", apiRouter);

// health check API
app.get("/_health", (req: Request, res: Response) => {
    if (healthCheck()) {
        res.status(httpStatus.OK).json({ status: "UP" });
    } else {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ status: "DOWN" });
    }
});

app.get("/callback", (req, res) => {
    console.log("Query: ", JSON.stringify(req.query));
    //getVNPayReturnData(req.query);
    res.send(req.query);
});

app.get("/debug-sentry", (req: Request, res: Response) =>{
    throw new Error("My first Sentry error!");
});

// send back a 404 error for any unknown api request
app.use("/robots.txt", function (req: Request, res: Response) {
    res.type("text/plain");
    res.send("User-agent: *\nDisallow: /");
});

app.use(Sentry.Handlers.errorHandler());

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(httpStatus.NOT_FOUND).send({
        status: 404,
        internalMessage: "Route not found",
        externalMessage: "Route not found",
        success: false
    });
});

export default app;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketplaceRouter from "./marketplace";
import farmsRouter from "./farms";
import accountRouter from "./account";
import ordersRouter from "./orders";
import negotiationsRouter from "./negotiations";
import messagesRouter from "./messages";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import billingRouter from "./billing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketplaceRouter);
router.use(accountRouter);
router.use(farmsRouter);
router.use(dashboardRouter);
router.use(ordersRouter);
router.use(negotiationsRouter);
router.use(messagesRouter);
router.use(storageRouter);
router.use(billingRouter);

export default router;

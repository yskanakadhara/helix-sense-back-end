import * as gatewayController from "../controllers/gateway.js";
import express from "express";
import { keycloak } from "../config/keycloak.js";

const router = express.Router();

router.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

router.get("/", keycloak.protect(), gatewayController.getGateways);

export default router;

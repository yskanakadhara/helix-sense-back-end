import * as sensorController from "../controllers/sensor.js";
import express from "express";
import { keycloak } from "../config/keycloak.js";

const router = express.Router();

router.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

router.get("/", keycloak.protect(), sensorController.getSensors);
router.get("/:sensorId", keycloak.protect(), sensorController.getSensorData);
router.post("/", keycloak.protect(), sensorController.createSensor);
router.put("/:sensorId", keycloak.protect(), sensorController.updateSensor);
router.delete("/:sensorId", keycloak.protect(), sensorController.deleteSensor);
router.get("/:sensorId/certificates", keycloak.protect(), sensorController.downloadCertificates);

export default router;

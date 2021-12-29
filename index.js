import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import db from "./app/models/index.js";
import user from "./app/routes/user.js";
import washroom from "./app/routes/washroom.js";
import infrastructure from "./app/routes/infrastructure.js";
import floor from "./app/routes/floor.js";
import component from "./app/routes/component.js";
import sensor from "./app/routes/sensor.js";
import sensor_type from "./app/routes/sensor_type.js";
import gateway from "./app/routes/gateway.js";
import dotenv from "dotenv";

dotenv.config();
import docClient from "./app/config/dynamo.js";
import { keycloak, memoryStore } from "./app/config/keycloak.js";
import session from "express-session";
const app = express();

// var corsOptions = {
//   origin: "http://localhost:8082",
// };

// app.use(cors(corsOptions));
app.use(cors());

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(
//   session({
//     secret: "some secret",
//     resave: false,
//     saveUninitialized: true,
//     store: memoryStore,
//   })
// );
app.use(
  session({
    secret: "some secret",
    resave: false,
    saveUninitialized: true,
    store: memoryStore,
  })
);

app.use(keycloak.middleware());

const __dirname = path.resolve();
app.use("/static", express.static(path.join(__dirname, "public")));

const User = db.user;
const Site = db.site;
const Purchase = db.purchase;
const EnergyConsumption = db.energy_consumption;
const WorkOrder = db.work_order;
const Washroom = db.washroom;
const SensorType = db.sensor_type;

function getRandomElements(arr, n) {
  var result = new Array(n),
    len = arr.length,
    taken = new Array(len);
  if (n > len)
    throw new RangeError("getRandom: more elements taken than available");
  while (n--) {
    var x = Math.floor(Math.random() * len);
    result[n] = arr[x in taken ? taken[x] : x];
    taken[x] = --len in taken ? taken[len] : len;
  }
  return result;
}

function initialDynamo() {
  const printResults = function (err, resp) {
    console.log(
      "----------------------------------------------------------------------"
    );
    if (err) {
      console.log("Error running scan", err);
    } else {
      console.log("Found", resp.Count, "items");
      console.log(resp.Items);

      if (resp.ConsumedCapacity) {
        console.log(
          "----------------------------------------------------------------------"
        );
        console.log("Scan consumed: ", resp.ConsumedCapacity);
      }
    }

    console.log(
      "----------------------------------------------------------------------"
    );
  };

  const params = {
    TableName: "Occupancy",
    KeyConditionExpression: "#deviceid = :code",
    ExpressionAttributeNames: {
      "#deviceid": "deviceid",
    },
    ExpressionAttributeValues: {
      ":code": "01-aa-bb-cc-dd-03-02-05",
    },
    ScanIndexForward: false,
    Limit: 1,
  };

  docClient.query(params, printResults);
}

function initial() {
  Purchase.estimatedDocumentCount((err, count) => {
    if (!err && count === 0) {
      Purchase.insertMany([
        {
          number: "PURCHASE001",
          status: "None Received",
        },
        {
          number: "PURCHASE002",
          status: "Part Received",
        },
        {
          number: "PURCHASE003",
          status: "None Received",
        },
        {
          number: "PURCHASE004",
          status: "None Received",
        },
        {
          number: "PURCHASE005",
          status: "None Received",
        },
        {
          number: "PURCHASE006",
          status: "Part Received",
        },
        {
          number: "PURCHASE007",
          status: "None Received",
        },
      ])
        .then(() => {
          console.log("added purchases");
        })
        .catch((err) => console.log("error", err));
    }
  });

  EnergyConsumption.estimatedDocumentCount((err, count) => {
    if (!err && count === 0) {
      EnergyConsumption.insertMany([
        {
          equipmentNumber: "EQUIPMENT0001",
          date: new Date(2021, 8, 1, 12, 9, 42),
          value: 123.1,
          type: "Amps",
        },
        {
          equipmentNumber: "EQUIPMENT0002",
          date: new Date(2021, 8, 2, 9, 0, 42),
          value: 123.2,
          type: "Boosts",
        },
        {
          equipmentNumber: "EQUIPMENT0003",
          date: new Date(2021, 7, 31, 18, 9, 5),
          value: 123.3,
          type: "Amps",
        },
        {
          equipmentNumber: "EQUIPMENT0004",
          date: new Date(2021, 8, 16, 5, 0, 0),
          value: 123.4,
          type: "Amps",
        },
        {
          equipmentNumber: "EQUIPMENT0005",
          date: new Date(2021, 8, 17, 12, 0, 0),
          value: 123.5,
          type: "Boosts",
        },
        {
          equipmentNumber: "EQUIPMENT0006",
          date: new Date(2021, 8, 15, 15, 10, 0),
          value: 123.6,
          type: "Boosts",
        },
      ])
        .then(() => {
          console.log("added consumptions");
        })
        .catch((err) => console.log("error", err));
    }
  });

  WorkOrder.estimatedDocumentCount((err, count) => {
    if (!err && count === 0) {
      WorkOrder.insertMany([
        {
          number: "ORDER0001",
          equipmentNumber: "EQUIPMENT0001",
          equipmentName: "Equipment 1",
          make: "MAKE 1",
          market: "COMPANY 1",
        },
        {
          number: "ORDER0002",
          equipmentNumber: "EQUIPMENT0002",
          equipmentName: "Equipment 2",
          make: "MAKE 2",
          market: "COMPANY 2",
        },
        {
          number: "ORDER0003",
          equipmentNumber: "EQUIPMENT0003",
          equipmentName: "Equipment 3",
          make: "MAKE 3",
          market: "COMPANY 3",
        },
        {
          number: "ORDER0004",
          equipmentNumber: "EQUIPMENT0004",
          equipmentName: "Equipment 4",
          make: "MAKE 4",
          market: "COMPANY 4",
        },
        {
          number: "ORDER0005",
          equipmentNumber: "EQUIPMENT0005",
          equipmentName: "Equipment 5",
          make: "MAKE 5",
          market: "COMPANY 5",
        },
        {
          number: "ORDER0006",
          equipmentNumber: "EQUIPMENT0006",
          equipmentName: "Equipment 6",
          make: "MAKE 6",
          market: "COMPANY 6",
        },
        {
          number: "ORDER0007",
          equipmentNumber: "EQUIPMENT0007",
          equipmentName: "Equipment 7",
          make: "MAKE 7",
          market: "COMPANY 7",
        },
        {
          number: "ORDER0008",
          equipmentNumber: "EQUIPMENT0008",
          equipmentName: "Equipment 8",
          make: "MAKE 8",
          market: "COMPANY 8",
        },
        {
          number: "ORDER0009",
          equipmentNumber: "EQUIPMENT0009",
          equipmentName: "Equipment 9",
          make: "MAKE 9",
          market: "COMPANY 9",
        },
      ])
        .then(() => {
          console.log("added work orders");
        })
        .catch((err) => console.log("error", err));
    }
  });

  Site.estimatedDocumentCount(async (err, count) => {
    if (!err && count === 0) {
      let purchases = await Purchase.find();
      let consumptions = await EnergyConsumption.find();
      let orders = await WorkOrder.find();
      Site.insertMany([
        {
          name: "TEXAS",
          corrective_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [3, 6, 6],
          },
          preventive_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [3, 6, 6],
          },
          purchases: getRandomElements(purchases, 4).map((p) => p._id),
          energy_consumptions: getRandomElements(consumptions, 2).map(
            (c) => c._id
          ),
          work_orders: getRandomElements(orders, 6).map((order) => order._id),
        },
        {
          name: "BANGALORE",
          corrective_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [6, 6, 9],
          },
          preventive_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [6, 6, 9],
          },
          purchases: getRandomElements(purchases, 6).map((p) => p._id),
          energy_consumptions: getRandomElements(consumptions, 6).map(
            (c) => c._id
          ),
          work_orders: getRandomElements(orders, 8).map((order) => order._id),
        },
        {
          name: "COIMBATORE ZONE",
          corrective_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [1, 4.5, 3],
          },
          preventive_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [1, 4.5, 3],
          },
          purchases: getRandomElements(purchases, 3).map((p) => p._id),
          energy_consumptions: getRandomElements(consumptions, 5).map(
            (c) => c._id
          ),
          work_orders: getRandomElements(orders, 7).map((order) => order._id),
        },
        {
          name: "HYDERABAD",
          corrective_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [9, 5, 5],
          },
          preventive_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [9, 5, 5],
          },
          purchases: getRandomElements(purchases, 5).map((p) => p._id),
          energy_consumptions: getRandomElements(consumptions, 4).map(
            (c) => c._id
          ),
          work_orders: getRandomElements(orders, 9).map((order) => order._id),
        },
        {
          name: "MUMBAI",
          corrective_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [3, 6, 9],
          },
          preventive_maintenance: {
            labels: ["CLOSED", "OPEN", "PENDING"],
            data: [3, 6, 9],
          },
          purchases: getRandomElements(purchases, 2).map((p) => p._id),
          energy_consumptions: getRandomElements(consumptions, 3).map(
            (c) => c._id
          ),
          work_orders: getRandomElements(orders, 5).map((order) => order._id),
        },
      ])
        .then(() => {
          console.log("added sites");
        })
        .catch((err) => console.log("error", err));
    }
  });

  SensorType.estimatedDocumentCount(async (err, count) => {
    if (!err && count === 0) {
      SensorType.insertMany([
        {
          code: "01-aa-bb-cc-dd-03-02-05",
          description: "Some test description",
          components: [],
        },
        {
          code: "01-aa-bb-cc-dd-03-02-01",
          description: "Some test description",
          components: [],
        },
        {
          code: "01-aa-bb-cc-dd-03-04-01",
          description: "Some test description",
          components: [],
        },
      ])
        .then(() => {
          console.log("added sensor types");
        })
        .catch((err) => console.log("error", err));
    }
  });
}

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to HelixSense application." });
});

app.get("/user/:subId/logo/:fileName", (req, res) => {
  const { subId, fileName } = req.params;
  const file = `${process.env.UPLOAD_DIR}/${subId}/${fileName}`;
  if (fs.existsSync(file)) {
    res.sendFile(file); // Set disposition and send it.
  } else {
    res.send("File not found!", 404);
  }
});

app.get("/icons/:fileName", (req, res) => {
  const { fileName } = req.params;
  const file = `${process.env.UPLOAD_DIR}/icons/${fileName}`;
  if (fs.existsSync(file)) {
    res.sendFile(file); // Set disposition and send it.
  } else {
    res.send("File not found!", 404);
  }
});

// app.get("/api/infrastructures", (req, res) => {
//   res.status(200).send([]);
// });

// app.get("/api/verify", keycloak.protect("realm:app-user"), (req, res) => {
//   console.log(JSON.stringify(req.kauth.grant))
//   res.status(200).send("Token validated successfully");
// });

// app.use("/api/auth", auth);

app.use("/api/user", user);
app.use("/api/washrooms", washroom);
app.use("/api/infrastructures", infrastructure);
app.use("/api/components", component);
app.use("/api/floors", floor);
app.use("/api/sensors", sensor);
app.use("/api/sensor_types", sensor_type);
app.use("/api/gateways", gateway);

// set port, listen for requests
const PORT = process.env.PORT || 8081;

db.mongoose
  .connect(process.env.DATABASE_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Successfully connect to MongoDB.");
    initial();
    // initialDynamo();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}.`);
    });
  })
  .catch((err) => {
    console.error("Connection error", err);
    process.exit();
  });

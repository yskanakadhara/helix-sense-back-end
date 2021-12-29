import db from "../models/index.js";
import docClient from "../config/dynamo.js";
import { generateCertificateAndJsonConfig } from "../utils/sensor.js";
import fs from "fs";
import path from "path";

const Washroom = db.washroom;
const Floor = db.floor;
const Infrastructure = db.infrastructure;
const Sensor = db.sensor;
const SensorType = db.sensor_type;
const User = db.user;
const Gateway = db.gateway;
const Room = db.room;

export const getSensors = async (req, res) => {
  const { sub } = req.kauth.grant.access_token.content;
  User.findOne({ sub: sub })
    .populate({
      path: "infrastructures",
      populate: {
        path: "floors",
        populate: {
          path: "washrooms",
          populate: { path: "sensors" },
        },
      },
    })
    .exec((err, user) => {
      if (err) {
        console.log(err);
        res.status(400).send(err);
      } else {
        if (!user) {
          res.status(400).send("User not found");
        } else {
          const floors = user.infrastructures
            .map((infra) => infra.floors)
            .flat();
          const washrooms = floors.map((floor) => floor.washrooms).flat();
          const sensors = washrooms.map((wr) => wr.sensors).flat();
          res.status(200).send(sensors);
        }
      }
    });
};

export const createSensor = async (req, res) => {
  console.log("createSensor");
  const { sub } = req.kauth.grant.access_token.content;
  const {
    device_id,
    code,
    description,
    infrastructure,
    floor,
    washroom,
    gateway,
  } = req.body;

  // const ss = await Sensor.findOne({ device_id, code });
  // if (ss) {
  //   res.status(400).send("Sensor already in used");
  //   return;
  // }

  // Create infrastructure for sensor if needed
  let washroom_id = "";
  if (washroom._id === "ADDNEW") {
    const { type } = washroom;
    const new_washroom = await Washroom.create({
      type,
    });
    if (!new_washroom) {
      res.status(500).send("Failed to create washroom");
      return;
    }
    washroom_id = new_washroom._id;
  } else {
    washroom_id = washroom._id;
  }

  let floor_id = "";
  if (floor._id === "ADDNEW") {
    const { sign, description } = floor;
    let index = 0;
    if (/^B[0-9]+$/i.test(sign)) {
      index = -1 * Number(sign.replace("B", ""));
    } else if (sign !== "G") {
      index = Number(sign);
    }
    const new_floor = await Floor.create({
      sign,
      description,
      index,
      washrooms: [washroom_id],
    });
    if (!new_floor) {
      res.status(500).send("Failed to create floor");
      return;
    }
    floor_id = new_floor._id;
  } else {
    floor_id = floor._id;
    await Floor.findByIdAndUpdate(floor._id, {
      $addToSet: { washrooms: washroom_id },
    });
  }

  let infrastructure_id = "";
  if (infrastructure._id === "ADDNEW") {
    const { name, description, location, type } = infrastructure;
    const new_infra = await Infrastructure.create({
      name,
      description,
      location,
      type,
      floors: [floor_id],
    });
    if (!new_infra) {
      res.status(500).send("Failed to create infrastructure");
      return;
    }
    infrastructure_id = new_infra._id;
    await User.findOneAndUpdate(
      { sub },
      {
        $addToSet: { infrastructures: new_infra._id },
      }
    );
  } else {
    infrastructure_id = infrastructure._id;
    await Infrastructure.findByIdAndUpdate(infrastructure._id, {
      $addToSet: { floors: floor_id },
    });
    await User.findOneAndUpdate(
      { sub },
      {
        $addToSet: { infrastructures: infrastructure._id },
      }
    );
  }

  // Create gateway if needed
  let gw_id = "";
  const { gateway_id, region, city, state, company, company_unit } = gateway;
  if (gateway._id === "ADDNEW") {
    const gw_infrastructure = gateway.infrastructure;
    const gw_floor = gateway.floor;
    const gw_washroom = gateway.room;
    let gw_washroom_id = "";
    let gw_room_id = "";
    if (gw_washroom._id === "ADDNEW") {
      const { type } = gw_washroom;
      const new_gw_washroom = await Washroom.create({
        type,
      });
      if (!new_gw_washroom) {
        res.status(500).send("Failed to create gateway washroom");
        return;
      }
      gw_washroom_id = new_gw_washroom._id;
    } else if (gw_washroom._id === "ADDNEWROOM") {
      const { label, description } = gw_washroom;
      const new_gw_room = await Room.create({
        label,
        description,
      });
      if (!new_gw_room) {
        res.status(500).send("Failed to create gateway room");
        return;
      }
      gw_room_id = new_gw_room._id;
    } else if (gw_washroom._id === "SAME_WITH_SENSOR") {
      gw_washroom_id = washroom_id;
    } else {
      gw_washroom_id = gw_washroom._id;
    }

    let gw_floor_id = "";
    if (gw_floor._id === "ADDNEW") {
      const { sign, description } = gw_floor;
      let index = 0;
      if (/^B[0-9]+$/i.test(sign)) {
        index = -1 * Number(sign.replace("B", ""));
      } else if (sign !== "G") {
        index = Number(sign);
      }
      const new_gw_floor = await Floor.create({
        sign,
        description,
        index,
        washrooms: (gw_washroom_id && [gw_washroom_id]) || [],
        rooms: (gw_room_id && [gw_room_id]) || [],
      });
      if (!new_gw_floor) {
        res.status(500).send("Failed to create gateway floor");
        return;
      }
      gw_floor_id = new_gw_floor._id;
    } else if (gw_floor._id === "SAME_WITH_SENSOR") {
      gw_floor_id = floor_id;
      if (gw_washroom_id !== "") {
        await Floor.findByIdAndUpdate(gw_floor_id, {
          $addToSet: { washrooms: gw_washroom_id },
        });
      } else if (gw_room_id !== "") {
        await Floor.findByIdAndUpdate(gw_floor_id, {
          $addToSet: { rooms: gw_room_id },
        });
      }
    } else {
      gw_floor_id = gw_floor._id;
      if (gw_washroom_id !== "") {
        await Floor.findByIdAndUpdate(gw_floor._id, {
          $addToSet: { washrooms: gw_washroom_id },
        });
      } else if (gw_room_id !== "") {
        await Floor.findByIdAndUpdate(gw_floor._id, {
          $addToSet: { rooms: gw_room_id },
        });
      }
    }

    let gw_infra_id = "";
    if (gw_infrastructure._id === "ADDNEW") {
      const { name, description, location, type } = gw_infrastructure;
      const new_gw_infra = await Infrastructure.create({
        name,
        description,
        location,
        type,
        floors: [gw_floor_id],
      });
      if (!new_gw_infra) {
        res.status(500).send("Failed to create gateway infrastructure");
        return;
      }
      gw_infra_id = new_gw_infra;
    } else if (gw_infrastructure._id === "SAME_WITH_SENSOR") {
      gw_infra_id = infrastructure_id;
    } else {
      gw_infra_id = gw_infrastructure._id;
      await Infrastructure.findByIdAndUpdate(gw_infrastructure._id, {
        $addToSet: { floors: gw_floor_id },
      });
    }

    await User.findOneAndUpdate(
      { sub },
      {
        $addToSet: { infrastructures: gw_infra_id },
      }
    );

    if (gw_washroom_id !== "") {
      const new_gw = await Gateway.create({
        gateway_id,
        region,
        city,
        state,
        company,
        company_unit,
        washroom: gw_washroom_id,
      });

      if (!new_gw) {
        res.status(500).send("Failed to create gateway");
        return;
      }
      gw_id = new_gw._id;
    } else {
      const new_gw = await Gateway.create({
        gateway_id,
        region,
        city,
        state,
        company,
        company_unit,
        room: gw_room_id,
      });

      if (!new_gw) {
        res.status(500).send("Failed to create gateway");
        return;
      }
      gw_id = new_gw._id;
    }

    await User.findOneAndUpdate(
      { sub },
      {
        $addToSet: { gateways: gw_id },
      }
    );
  } else {
    gw_id = gateway._id;
  }

  const sensor = await Sensor.create({
    device_id,
    code,
    description,
    gateway: gw_id,
  });
  if (sensor) {
    await Washroom.findByIdAndUpdate(washroom_id, {
      $addToSet: { sensors: sensor._id },
    });
    const user = await User.findOne({ sub });
    await generateCertificateAndJsonConfig(user, sensor, region, res);
  } else {
    res.status(500).send("Failed to create sensor");
  }
};

export const updateSensor = async (req, res) => {
  const { sub } = req.kauth.grant.access_token.content;
  const { sensorId } = req.params;
  const {
    device_id,
    code,
    description,
    infrastructure,
    floor,
    washroom,
    gateway,
  } = req.body;

  // Create infrastructure for sensor if needed
  let washroom_id = "";
  if (washroom._id === "ADDNEW") {
    const { type } = washroom;
    const new_washroom = await Washroom.create({
      type,
      sensors: [sensorId],
    });
    if (!new_washroom) {
      res.status(500).send("Failed to create washroom");
      return;
    }
    washroom_id = new_washroom._id;
    await Washroom.findOneAndUpdate(
      { sensors: sensorId },
      { $pull: { sensors: sensorId } }
    );
  } else {
    washroom_id = washroom._id;
  }

  let floor_id = "";
  if (floor._id === "ADDNEW") {
    const { sign, description } = floor;
    let index = 0;
    if (/^B[0-9]+$/i.test(sign)) {
      index = -1 * Number(sign.replace("B", ""));
    } else if (sign !== "G") {
      index = Number(sign);
    }
    const new_floor = await Floor.create({
      sign,
      description,
      index,
      washrooms: [washroom_id],
    });
    if (!new_floor) {
      res.status(500).send("Failed to create floor");
      return;
    }
    floor_id = new_floor._id;
  } else {
    floor_id = floor._id;
    const { sign, description } = floor;
    let index = 0;
    if (/^B[0-9]+$/i.test(sign)) {
      index = -1 * Number(sign.replace("B", ""));
    } else if (sign !== "G") {
      index = Number(sign);
    }
    await Floor.findByIdAndUpdate(floor._id, {
      $addToSet: { washrooms: washroom_id },
      $set: { sign, index, description },
    });
  }

  let infrastructure_id = "";
  if (infrastructure._id === "ADDNEW") {
    const { name, description, location, type } = infrastructure;
    const new_infra = await Infrastructure.create({
      name,
      description,
      location,
      type,
      floors: [floor_id],
    });
    if (!new_infra) {
      res.status(500).send("Failed to create infrastructure");
      return;
    }
    infrastructure_id = new_infra._id;
    await User.findOneAndUpdate(
      { sub },
      {
        $addToSet: { infrastructures: new_infra._id },
      }
    );
  } else {
    infrastructure_id = infrastructure._id;
    const { name, description, location, type } = infrastructure;
    await Infrastructure.findByIdAndUpdate(infrastructure._id, {
      $addToSet: { floors: floor_id },
      $set: { name, description, location, type },
    });
    await User.findOneAndUpdate(
      { sub },
      {
        $addToSet: { infrastructures: infrastructure._id },
      }
    );
  }

  const gw_infrastructure = gateway.infrastructure;
  const gw_floor = gateway.floor;
  const gw_washroom = gateway.room;
  let gw_washroom_id = "";
  let gw_room_id = "";
  if (gw_washroom._id === "ADDNEW") {
    const { type } = gw_washroom;
    const new_gw_washroom = await Washroom.create({
      type,
    });
    if (!new_gw_washroom) {
      res.status(500).send("Failed to create gateway washroom");
      return;
    }
    gw_washroom_id = new_gw_washroom._id;
  } else if (gw_washroom._id === "ADDNEWROOM") {
    const { label, description } = gw_washroom;
    const new_gw_room = await Room.create({
      label,
      description,
    });
    if (!new_gw_room) {
      res.status(500).send("Failed to create gateway room");
      return;
    }
    gw_room_id = new_gw_room._id;
  } else if (gw_washroom._id === "SAME_WITH_SENSOR") {
    gw_washroom_id = washroom_id;
  } else {
    gw_washroom_id = gw_washroom._id;
  }

  let gw_floor_id = "";
  if (gw_floor._id === "ADDNEW") {
    const { sign, description } = gw_floor;
    let index = 0;
    if (/^B[0-9]+$/i.test(sign)) {
      index = -1 * Number(sign.replace("B", ""));
    } else if (sign !== "G") {
      index = Number(sign);
    }
    const new_gw_floor = await Floor.create({
      sign,
      description,
      index,
      washrooms: (gw_washroom_id && [gw_washroom_id]) || [],
      rooms: (gw_room_id && [gw_room_id]) || [],
    });
    if (!new_gw_floor) {
      res.status(500).send("Failed to create gateway floor");
      return;
    }
    gw_floor_id = new_gw_floor._id;
  } else if (gw_floor._id === "SAME_WITH_SENSOR") {
    gw_floor_id = floor_id;
    if (gw_washroom_id !== "") {
      await Floor.findByIdAndUpdate(gw_floor_id, {
        $addToSet: { washrooms: gw_washroom_id },
      });
    } else if (gw_room_id !== "") {
      await Floor.findByIdAndUpdate(gw_floor_id, {
        $addToSet: { rooms: gw_room_id },
      });
    }
  } else if (gw_floor._id !== floor_id) {
    gw_floor_id = gw_floor._id;
    const { sign, description } = gw_floor;
    let index = 0;
    if (/^B[0-9]+$/i.test(sign)) {
      index = -1 * Number(sign.replace("B", ""));
    } else if (sign !== "G") {
      index = Number(sign);
    }
    if (gw_washroom_id !== "") {
      await Floor.findByIdAndUpdate(gw_floor._id, {
        $addToSet: { washrooms: gw_washroom_id },
      });
    } else if (gw_room_id !== "") {
      await Floor.findByIdAndUpdate(gw_floor._id, {
        $addToSet: { rooms: gw_room_id },
      });
    }
  } else {
    gw_floor_id = floor_id;
    if (gw_washroom_id !== "") {
      await Floor.findByIdAndUpdate(floor_id, {
        $addToSet: { washrooms: gw_washroom_id },
      });
    } else if (gw_room_id !== "") {
      await Floor.findByIdAndUpdate(floor_id, {
        $addToSet: { rooms: gw_room_id },
      });
    }
  }

  let gw_infra_id = "";
  if (gw_infrastructure._id === "ADDNEW") {
    const { name, description, location, type } = gw_infrastructure;
    const new_gw_infra = await Infrastructure.create({
      name,
      description,
      location,
      type,
      floors: [gw_floor_id],
    });
    if (!new_gw_infra) {
      res.status(500).send("Failed to create gateway infrastructure");
      return;
    }
    gw_infra_id = new_gw_infra;
  } else if (gw_infrastructure._id === "SAME_WITH_SENSOR") {
    gw_infra_id = infrastructure_id;
  } else if (gw_infrastructure._id !== infrastructure_id) {
    gw_infra_id = gw_infrastructure._id;
    const { name, description, location, type } = gw_infrastructure;
    await Infrastructure.findByIdAndUpdate(gw_infrastructure._id, {
      $addToSet: { floors: gw_floor_id },
      $set: { name, description, location, type },
    });
  } else {
    gw_infra_id = infrastructure_id;
  }

  await User.findOneAndUpdate(
    { sub },
    {
      $addToSet: { infrastructures: gw_infra_id },
    }
  );
  // Create gateway if needed
  let gw_id = "";
  if (gateway._id === "ADDNEW") {
    const { gateway_id, region, city, state, company, company_unit } = gateway;
    const new_gw = await Gateway.create({
      gateway_id,
      region,
      city,
      state,
      company,
      company_unit,
      washroom: gw_washroom_id || null,
      room: gw_room_id || null,
    });

    if (!new_gw) {
      res.status(500).send("Failed to create gateway");
      return;
    }
    gw_id = new_gw._id;
    await User.findOneAndUpdate(
      { sub },
      {
        $addToSet: { gateways: new_gw._id },
      }
    );
  } else {
    gw_id = gateway._id;
    const { gateway_id, region, city, state, company, company_unit } = gateway;
    await Gateway.findByIdAndUpdate(gateway._id, {
      gateway_id,
      region,
      city,
      state,
      company,
      company_unit,
      washroom: gw_washroom_id || null,
      room: gw_room_id || null,
    });
  }
  const sensor = await Sensor.findOneAndUpdate(
    { _id: sensorId },
    { device_id, code, description, gateway: gw_id }
  );
  if (!sensor) {
    res.status(400).send("Sensor update failed");
  } else {
    const wr = await Washroom.findOne({ sensors: sensor._id });
    const fl = await Floor.findOne({ washrooms: washroom_id }).populate({
      path: "washrooms",
    });
    const infra = await Infrastructure.findOne({ floors: floor_id }).populate({
      path: "floors",
      populate: {
        path: "washrooms",
      },
    });
    const gw = await Gateway.findById(sensor.gateway);
    let gw_wr;
    let gw_fl;
    let gw_r;
    if (gw_washroom_id !== "") {
      gw_wr = await Washroom.findById(gw_washroom_id);
      gw_fl = await Floor.findOne({ washrooms: gw_washroom_id }).populate([
        {
          path: "rooms",
        },
        { path: "washrooms" },
      ]);
    } else {
      gw_r = await Room.findById(gw_room_id);
      gw_fl = await Floor.findOne({ rooms: gw_room_id }).populate([
        {
          path: "rooms",
        },
        { path: "washrooms" },
      ]);
    }

    const gw_infra = await Infrastructure.findOne({
      floors: gw_floor_id,
    }).populate({
      path: "floors",
      populate: [
        {
          path: "washrooms",
        },
        {
          path: "rooms",
        },
      ],
    });
    res.status(200).send({
      ...sensor._doc,
      infrastructure: infra,
      floor: fl,
      washroom: wr,
      gateway: {
        ...gw._doc,
        infrastructure: gw_infra,
        floor: gw_fl,
        washroom: gw_wr,
        room: gw_r,
      },
    });
  }
};

export const deleteSensor = async (req, res) => {
  const { sensorId } = req.params;
  Sensor.findOneAndDelete({ _id: sensorId }).exec((err, sensor) => {
    if (err) {
      console.log(err);
      res.status(400).send("Sensor delete failed");
    } else {
      Washroom.findOneAndUpdate(
        { sensors: sensorId },
        { $pull: { sensors: sensorId } }
      ).exec((err, washroom) => {
        if (washroom) {
          res.status(200).send(sensor);
        } else {
          res.status(400).send("Failed to update washroom");
        }
      });
    }
  });
};

export const getSensorData = async (req, res) => {
  console.log("getsensor", req.params);
  const { sensorId } = req.params;
  const sensor = await Sensor.findOne({ _id: sensorId }).exec();
  if (!sensor) {
    res.status(404).send("Sensor not found");
    return;
  }
  console.log("sensor.code", sensor.code)
  const sensor_type = await SensorType.findOne({ code: sensor.code }).populate({
    path: "components",
    populate: { path: "component" },
  });

  console.log("sensor_type", sensor_type);

  if (!sensor_type) {
    res
      .status(404)
      .send("Sensor type is not defined, please contact administrator");
    return;
  }
  const washroom = await Washroom.findOne({ sensors: sensor._id });
  if (!washroom) {
    res
      .status(404)
      .send(
        "Sensor is not belongs to any washroom, please contact administrator"
      );
    return;
  }
  const floor = await Floor.findOne({ washrooms: washroom._id }).populate({
    path: "washrooms",
  });
  if (!floor) {
    res
      .status(404)
      .send(
        "Washroom is not belongs to any floor, please contact administrator"
      );
    return;
  }
  const infra = await Infrastructure.findOne({ floors: floor._id }).populate({
    path: "floors",
    populate: {
      path: "washrooms",
    },
  });
  if (!infra) {
    res
      .status(404)
      .send("Floor is not belongs to any infra, please contact administrator");
    return;
  }

  const gateway = await Gateway.findById(sensor.gateway);
  if (!gateway) {
    res.status(404).send("There is no gateway for this sensor");
    return;
  }
  let gw_washroom;
  let gw_floor;
  let gw_room;

  if (gateway.washroom != null) {
    console.log(gateway.washroom);
    gw_washroom = await Washroom.findById(gateway.washroom);
    gw_floor = await Floor.findOne({ washrooms: gateway.washroom }).populate([
      {
        path: "rooms",
      },
      { path: "washrooms" },
    ]);
  } else {
    console.log(gateway.room);
    gw_room = await Room.findById(gateway.room);
    gw_floor = await Floor.findOne({ rooms: gateway.room }).populate([
      {
        path: "rooms",
      },
      { path: "washrooms" },
    ]);
  }
  const gw_infra = await Infrastructure.findOne({
    floors: gw_floor._id,
  }).populate({
    path: "floors",
    populate: [
      {
        path: "washrooms",
      },
      {
        path: "rooms",
      },
    ],
  });
  const params = {
    TableName: "Occupancy",
    KeyConditionExpression: "#deviceid = :code",
    ExpressionAttributeNames: {
      "#deviceid": "deviceid",
    },
    ExpressionAttributeValues: {
      ":code": sensor.code,
    },
    ScanIndexForward: false,
    Limit: 1,
  };
  const result = await docClient.query(params).promise();
  res.status(200).send({
    ...sensor._doc,
    components: sensor_type.components,
    infrastructure: infra,
    floor,
    washroom,
    data: result.Items[0],
    gateway: {
      ...gateway._doc,
      infrastructure: gw_infra,
      floor: gw_floor,
      washroom: gw_washroom,
      room: gw_room,
    },
  });
};

export const getSensorKeys = async (req, res) => {
  const { washroomId } = req.params;
  Washroom.findById(washroomId)
    .populate({ path: "sensors" })
    .exec(async (err, washroom) => {
      if (err || !washroom) {
        console.log(err);
        res.status(400).send("Cannot find washroom");
      } else {
        const sensors = washroom.sensors;
        const data = [];
        for (let i = 0; i < sensors.length; i++) {
          const params = {
            TableName: "Occupancy",
            KeyConditionExpression: "#deviceid = :code",
            ExpressionAttributeNames: {
              "#deviceid": "deviceid",
            },
            ExpressionAttributeValues: {
              ":code": sensors[i].code,
            },
            ScanIndexForward: false,
            Limit: 1,
          };
          const result = await docClient.query(params).promise();
          data.push(
            Object.keys(result.Items[0]).filter(
              (key) => key !== "deviceid" && key !== "timez"
            )
          );
        }
        res.status(200).send([...new Set(data.flat(1))]);
      }
    });
};

export const downloadCertificates = async (req, res) => {
  console.log("downloadcertificate");
  const { sensorId } = req.params;
  const { sub } = req.kauth.grant.access_token.content;
  const sensor = await Sensor.findOne({ _id: sensorId }).exec();
  if (!sensor) {
    res.status(404).send("Sensor not found");
    return;
  }
  const file = `${process.env.CERTIFICATE_DIR_DOWN}/${sub}/${sensor.device_id}.zip`;
  console.log("file", file);
  const __dirname = path.resolve();
  if (fs.existsSync(__dirname + file)) {
    console.log("Downloading file", file);
    res.setHeader("Content-type", "application/zip");

    console.log("__dirname", __dirname);

    res.sendFile(__dirname + file); // Set disposition and send it.
  }
  //  else {
  //   res.send("File not found!", 404);
  // }
};

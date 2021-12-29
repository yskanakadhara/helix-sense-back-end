import mongoose from "mongoose";
import user from "./user.js";
import site from "./site.js"
import purchase from "./purchase.js"
import energy_consumption from "./energy_consumption.js"
import work_order from "./work_order.js"
import washroom from "./washroom.js"
import sensor from "./sensor.js"
import sensor_type from "./sensor_type.js"
import infrastructure from "./infrastructure.js"
import floor from "./floor.js"
import component from "./component.js"
import gateway from "./gateway.js"
import room from "./room.js"

mongoose.Promise = global.Promise;

const db = {};

db.mongoose = mongoose;

db.user = user;
db.site = site;
db.purchase = purchase;
db.energy_consumption = energy_consumption;
db.work_order = work_order;
db.washroom = washroom;
db.room = room;
db.sensor = sensor;
db.sensor_type = sensor_type;
db.infrastructure = infrastructure;
db.floor = floor;
db.component = component;
db.gateway = gateway;

export default db;

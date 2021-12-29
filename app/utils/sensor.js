import db from "../models/index.js";
import { spawn } from "child_process";
import fs from "fs";
import archiver from "archiver";
import { certificateTemplate, transporter } from "../utils/email.js";
spawn('node', ['script.js'])


const Washroom = db.washroom;
const Floor = db.floor;
const Infrastructure = db.infrastructure;
const Sensor = db.sensor;
const SensorType = db.sensor_type;
const User = db.user;
const Gateway = db.gateway;
const Room = db.room;

export const generateCertificateAndJsonConfig = async (
  user,
  sensor,
  region,
  res
) => {
  console.log("called generate --->")
  const dir = `${process.env.CERTIFICATE_DIR}/${user.sub}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  console.log("process.env.CERTIFICATE_SCRIPT-->", process.env.CERTIFICATE_SCRIPT);
  console.log("dir-->", dir);
  console.log("sensor.device_id.trim()-->", sensor.device_id.trim());
  console.log("region-->", region);
  console.log("user.email-->", user.email);
  const python = spawn("python", [
    process.env.CERTIFICATE_SCRIPT,
    dir,
    sensor.device_id.trim(),
    region,
    user.email,
  ]
  );

  let data = "";
  for await (const chunk of python.stdout) {
      // console.log('stdout chunk: '+chunk);
      data += chunk;
  }
  let error = "";
  for await (const chunk of python.stderr) {
      // console.error('stderr chunk: '+chunk);
      error += chunk;
  }
  const exitCode = await new Promise( (resolve, reject) => {
    python.on('close', resolve);
  });

  // if( exitCode) {
  //     throw new Error( `subprocess error exit ${exitCode}, ${error}`);
  // }

  if (!fs.existsSync(`${dir}/${sensor.device_id.trim()}.key`) || !fs.existsSync(`${dir}/${sensor.device_id.trim()}.crt`)) {
        res.status(500).send("Failed to generate sensor certificate");
  }

  // var commands = [
  //   'C:\\ProgramData\\Miniconda3\\Scripts\\activate.bat C:\\ProgramData\\Miniconda3',
  //   process.env.CERTIFICATE_SCRIPT,
  //   dir,
  //   sensor.device_id.trim(),
  //   region,
  //   user.email,
  //   // 'conda activate siva',
  //   //  'siva arg1  <some_file_input> arg2 arg3 arg4 <some_file_output>',
  // ]
  // var spawn_ = spawn(commands.join('&'), { shell: true });
  // console.log("spawn_", spawn_);

  // python.stdout.on('data', function (data) {
  //   //do something
  //   // console.log("data", data);
   
  // });

  // python.stderr.on('data', function (data) {
  //   //do something
  //   // console.log("data", data);
  // });
  
  // spawn.on('exit', function() {
  //   process.exit();
  // });
  // var myEmitter = require('events').EventEmitter;
  // python.on('exit', function (code) {
  //   console.log("code", code);
  //   // console.log("called-->exit", fs.existsSync(`${dir}/${sensor.device_id.trim()}.key`), !fs.existsSync(`${dir}/${sensor.device_id.trim()}.crt`));
  //   if (
  //     !fs.existsSync(`${dir}/${sensor.device_id.trim()}.key`) ||
  //     !fs.existsSync(`${dir}/${sensor.device_id.trim()}.crt`)
  //   ) {
  //     res.status(500).send("Failed to generate sensor certificate");
  //   }
  //   // process.exit(code);
  //   // myEmitter.emit('firstSpawn-finished');
  // });

  // myEmitter.on('firstSpawn-finished', () => {
  //   secondSpawn = spawn('echo', ['BYE!'])
  // })
  // const python = spawn("python3", [
  //   process.env.CERTIFICATE_SCRIPT,
  //   dir,
  //   sensor.device_id.trim(),
  //   region,
  //   user.email,
  // ]);

  // python.stderr.on("data", (data) => {
  //   console.error(`stderr: ${data}`);
  // });

  // python.on("close", async (code) => {
  //   if (
  //     !fs.existsSync(`${dir}/${sensor.device_id.trim()}.key`) ||
  //     !fs.existsSync(`${dir}/${sensor.device_id.trim()}.crt`)
  //   ) {
  //     res.status(500).send("Failed to generate sensor certificate");
  //   }

  // JSON file creation

  const washroom = await Washroom.findOne({ sensors: sensor._id });
  const floor = await Floor.findOne({ washrooms: washroom._id });
  const infra = await Infrastructure.findOne({ floors: floor._id });
  const gateway = await Gateway.findById(sensor.gateway);
  let gateway_washroom;
  let gateway_floor;
  let gateway_room;
  if (gateway.washroom) {
    gateway_washroom = await Washroom.findById(gateway.washroom);
    gateway_floor = await Floor.findOne({
      washrooms: gateway_washroom._id,
    });
  } else {
    gateway_room = await Room.findById(gateway.room);
    gateway_floor = await Floor.findOne({
      rooms: gateway_room._id,
    });
  }

  const gateway_infra = await Infrastructure.findOne({
    floors: gateway_floor._id,
  });

  const configData = {
    ...sensor._doc,
    washroom,
    floor,
    infrastructure: infra,
    gateway: {
      ...gateway._doc,
      washroom: gateway_washroom,
      room: gateway_room,
      floor: gateway_floor,
      infrastructure: gateway_infra,
    },
  };
  fs.writeFileSync(
    `${dir}/${sensor.device_id}.json`,
    JSON.stringify(configData)
  );

  const output = fs.createWriteStream(`${dir}/${sensor.device_id}.zip`);
  // console.log("output", output);
  const archive = archiver("zip", {
    gzip: true,
    zlib: { level: 9 }, // Sets the compression level.
  });
  // console.log("archive", archive);
  archive.on("error", function (err) {
    return false;
  });

  // pipe archive data to the output file
  archive.pipe(output);

  // append files
  archive.file(`${dir}/${sensor.device_id}.json`, {
    name: `${sensor.device_id}.json`,
  });
  archive.file(`${dir}/${sensor.device_id}.crt`, {
    name: `${sensor.device_id}.csr`,
  });
  archive.file(`${dir}/${sensor.device_id}.key`, {
    name: `${sensor.device_id}.key`,
  });

  //
  archive.finalize();
  const attachments = [
    {
      filename: `${sensor.device_id}.json`,
      path: `${dir}/${sensor.device_id}.json`,
    },
    {
      filename: `${sensor.device_id}.crt`,
      path: `${dir}/${sensor.device_id}.crt`,
    },
    {
      filename: `${sensor.device_id}.key`,
      path: `${dir}/${sensor.device_id}.key`,
    },
  ];
  const emailTemplate = certificateTemplate(user, attachments);

  const sendEmail = () => {
    console.log("Sending mail");
    transporter.sendMail(emailTemplate, (err, info) => {
      if (err) {
        console.log(err);
      } else {
        console.log(`** Email sent **`, info.response);
      }
    });
  };
  sendEmail();
  res.status(200).send(sensor);
  // });
};

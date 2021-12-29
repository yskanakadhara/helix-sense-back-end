import jwt from "jsonwebtoken";
import config from "../config/auth.js";
import db from "../models/index.js";
import fs from "fs";

const User = db.user;
const Site = db.site;

export const allAccess = (req, res) => {
  res.status(200).send("Public Content.");
};

export const userBoard = (req, res) => {
  res.status(200).send("User Content.");
};

export const adminBoard = (req, res) => {
  res.status(200).send("Admin Content.");
};

export const moderatorBoard = (req, res) => {
  res.status(200).send("Moderator Content.");
};

export const verifyToken = (req, res) => {
  const {
    sub,
    given_name,
    family_name,
    email,
    roles,
  } = req.kauth.grant.access_token.content;
  User.findOne({ sub: sub }).exec((err, user) => {
    if (err) {
      console.log(err);
    } else {
      if (!user) {
        User.create({ sub, given_name, family_name, email, roles })
          .then((u) =>
            console.log(`User ${u.given_name} ${u.family_name} created`)
          )
          .catch((e) => console.log(e));
      }
    }
  });
  res.status(200).send("Token valid.");
};

export const getUserInfo = (req, res) => {
  const {
    sub,
    given_name,
    family_name,
    email,
    roles
  } = req.kauth.grant.access_token.content;
  User.findOne({ sub: sub })
    .populate({ path: "infrastructures" })
    .exec((err, user) => {
      if (err) {
        console.log(err);
      } else {
        if (!user) {
          User.create({
            sub,
            given_name,
            family_name,
            email,
            roles,
            solutions: [],
            infrastructures: [],
          })
            .then((u) => {
              console.log(`User ${u.given_name} ${u.family_name} created`);
              res.status(200).send(u);
            })
            .catch((e) => {
              console.log(e);
              res.status(400).send("User not found");
            });
        } else {
          res.status(200).send(user);
        }
      }
    });
};

export const getSites = async (req, res) => {
  const roles = req.kauth.grant.access_token.content.roles;
  if (roles.includes("admin")) {
    Site.find().exec((err, sites) => {
      if (err) {
        console.log(err);
        res.status(400).send(err);
      }
      res.status(200).send(sites);
    });
  } else {
    const names = req.kauth.grant.access_token.content.sites.split(",");
    Site.find({ name: { $in: names } }).exec((err, sites) => {
      if (err) {
        console.log(err);
        res.status(400).send(err);
      }
      res.status(200).send(sites);
    });
  }
};

export const getSite = async (req, res) => {
  const { siteId } = req.params;
  Site.findById(siteId).exec((err, site) => {
    if (err) {
      console.log(err);
      res.status(400).send(err);
    }
    if (!site) res.status(400).send({ message: "Site not found" });
    site
      .populate("purchases")
      .populate("work_orders")
      .populate("energy_consumptions")
      .execPopulate()
      .then((resolve, reject) => {
        if (reject) {
          console.log(reject);
          res.status(400).send(reject);
        }
        res.status(200).send(resolve);
      });
  });
};

export const addSolution = async (req, res) => {
  const { sub } = req.kauth.grant.access_token.content;
  const { solution } = req.body;
  const user = await User.findOne({ sub: sub }).exec();
  if (!user) {
    res.status(400).send("User not found");
    return;
  }
  const solutions = user.solutions;
  if (!solutions.includes(solution)) {
    solutions.push(solution);
    solutions.sort();
  }
  const newUser = await User.findByIdAndUpdate(user._id, {
    solutions: solutions,
  })
    .populate({ path: "infrastructures" })
    .exec();

  if (newUser) {
    res.status(200).send({ ...newUser._doc, solutions });
  } else {
    res.status(500).send("Failed to add solutions");
  }
};

export const removeSolution = async (req, res) => {
  const { sub } = req.kauth.grant.access_token.content;
  const { solution } = req.body;
  const user = await User.findOne({ sub: sub }).exec();
  if (!user) {
    res.status(400).send("User not found");
    return;
  }
  const solutions = user.solutions.filter((s) => s !== solution);
  const newUser = await User.findByIdAndUpdate(user._id, {
    solutions: solutions,
  })
    .populate({ path: "infrastructures" })
    .exec();
  if (newUser) {
    res.status(200).send({ ...newUser._doc, solutions });
  } else {
    res.status(500).send("Failed to add solutions");
  }
};

export const uploadLogo = async (req, res) => {
  const { sub } = req.kauth.grant.access_token.content;
  const file = req.file;
  if (!file) {
    res.status(404).send("Please upload an image");
  }
  const user = await User.findOne({ sub: sub }).exec();
  if (!user) {
    res.status(400).send("User not found");
    return;
  }
  const logoUrl = `/user/${sub}/logo/${file.originalname}`;
  const newUser = await User.findByIdAndUpdate(user._id, {
    logo: logoUrl,
  })
    .populate({ path: "infrastructures" })
    .exec();
  if (newUser) {
    res.status(200).send({ ...newUser, logo: logoUrl });
  } else {
    res.status(500).send("Failed to add solutions");
  }
};

export const getLogo = async (req, res) => {
  const { subId, fileName } = req.params;
  const file = `${process.env.UPLOAD_DIR}/${subId}/${fileName}`;
  if (fs.existsSync(file)) {
    res.sendFile(file); // Set disposition and send it.
  } else {
    res.send("File not found!", 404);
  }
};

import db from "../models/index.js";

const Gateway = db.gateway;
const User = db.user;

export const getGateways = async (req, res) => {
  const { sub } = req.kauth.grant.access_token.content;
  User.findOne({ sub: sub })
    .populate([
      {
        path: "infrastructures",
        populate: {
          path: "floors",
          populate: {
            path: "washrooms",
            populate: { path: "sensors" },
          },
        },
      },
      { path: "gateways" },
    ])
    .exec((err, user) => {
      if (err) {
        console.log(err);
        res.status(400).send(err);
      } else {
        if (!user) {
          res.status(400).send("User not found");
        } else {
          res.status(200).send(user.gateways);
        }
      }
    });
};

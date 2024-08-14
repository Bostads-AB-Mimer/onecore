import configPackage from "@iteam/config";
import dotenv from "dotenv";
dotenv.config();

export interface Config {
  port: number;
  xledger: {};
  health: {
    xledger: {
      systemName: string;
      minimumMinutesBetweenRequests: number;
    };
  };
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5040,
    xledger: {
      baseUrl: "",
      apiKey: "",
    },
    health: {
      xledger: {
        systemName: "infobip",
        minimumMinutesBetweenRequests: 5,
      },
    },
  },
});

export default {
  port: config.get("port"),
  xledger: config.get(""),
  health: config.get("health"),
} as Config;

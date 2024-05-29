var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/logging/logger.ts
import pino from "pino";
import pinoElastic from "pino-elasticsearch";
import { multistream } from "pino-multi-stream";
import pretty from "pino-pretty";
import { randomUUID } from "crypto";
var streamToElastic = pinoElastic({
  index: "onecore-logging",
  node: process.env.ELASTICSEARCH_LOGGING_HOST || "http://localhost:9200",
  esVersion: 8,
  flushBytes: 100,
  flushInterval: 1e3
});
streamToElastic.on("error", (error) => console.log(error));
streamToElastic.on("insertError", (error) => console.log(error));
var prettyStream = pretty({
  colorize: true,
  ignore: "application,request",
  singleLine: true,
  messageFormat: "{msg} {request.path} {request.status}"
});
var pinoOptions = {};
var logger = pino(
  pinoOptions,
  multistream([{ stream: prettyStream }, { stream: streamToElastic }])
).child({ application: { name: "core", environment: process.env.NODE_ENV } });
var logger_default = logger;
var getCorrelationId = (ctx) => {
  var _a;
  return (_a = ctx.header["x-correlation-id"]) != null ? _a : randomUUID();
};
var middlewares = {
  pre: (ctx, next) => {
    var _a;
    ctx.logger = logger.child({ correlationId: getCorrelationId(ctx) });
    ctx.logger.info(
      {
        request: {
          path: ctx.path,
          user: (_a = ctx.state) == null ? void 0 : _a.user,
          method: ctx.method
        }
      },
      "Incoming request"
    );
    return next();
  },
  post: (ctx, next) => __async(void 0, null, function* () {
    var _a;
    yield next();
    ctx.logger.info(
      {
        request: {
          path: ctx.path,
          user: (_a = ctx.state) == null ? void 0 : _a.user,
          method: ctx.method,
          status: ctx.status
        }
      },
      "Incoming request complete"
    );
  })
};

// src/logging/loggedAxios.ts
import axios from "axios";
var instance = axios.create();
instance.interceptors.request.use((request) => {
  var _a;
  const requestFields = {
    url: request.url,
    headers: request.headers,
    method: request.method
  };
  logger_default.info(
    requestFields,
    `Outgoing request: ${(_a = request.method) == null ? void 0 : _a.toUpperCase()} ${request.url}`
  );
  return request;
});
instance.interceptors.response.use((response) => {
  var _a;
  const responseFields = {
    status: response.status,
    headers: response.headers,
    url: response.config.url
  };
  logger_default.info(
    responseFields,
    `Outgoing response: ${(_a = response.config.method) == null ? void 0 : _a.toUpperCase()} ${response.config.url} ${response.status}`
  );
  return response;
});
var loggedAxios_default = instance;
export {
  loggedAxios_default as loggedAxios,
  logger_default as logger,
  middlewares as loggerMiddlewares
};
//# sourceMappingURL=index.mjs.map
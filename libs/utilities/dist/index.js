"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
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

// src/index.ts
var src_exports = {};
__export(src_exports, {
  axiosTypes: () => axiosTypes,
  getCorrelationId: () => getCorrelationId,
  loggedAxios: () => loggedAxios_default,
  logger: () => logger,
  loggerMiddlewares: () => middlewares,
  loggingStorage: () => storage
});
module.exports = __toCommonJS(src_exports);

// src/logging/logger.ts
var import_pino = __toESM(require("pino"));
var import_pino_elasticsearch = __toESM(require("pino-elasticsearch"));
var import_pino_multi_stream = require("pino-multi-stream");
var import_pino_pretty = __toESM(require("pino-pretty"));
var import_crypto = require("crypto");

// src/logging/loggingStorage.ts
var import_async_hooks = require("async_hooks");
var storage = new import_async_hooks.AsyncLocalStorage();
var getCorrelationId = () => {
  const store = storage.getStore();
  if (store) {
    const correlationId = store.correlationId;
    return correlationId;
  } else {
    return void 0;
  }
};

// src/logging/logger.ts
var streamToElastic = (0, import_pino_elasticsearch.default)({
  index: "onecore-logging",
  node: process.env.ELASTICSEARCH_LOGGING_HOST || "http://localhost:9200",
  esVersion: 8,
  flushBytes: 100,
  flushInterval: 1e3
});
streamToElastic.on("error", (error) => console.log(error));
streamToElastic.on("insertError", (error) => console.log(error));
var prettyStream = (0, import_pino_pretty.default)({
  colorize: true,
  ignore: "application,request",
  singleLine: true,
  messageFormat: "{msg} {request.method} {request.path} {request.status}"
});
var pinoOptions = {
  mixin() {
    return { correlationId: getCorrelationId() };
  }
};
var childProperties = {
  application: {
    name: process.env.APPLICATION_NAME || "application",
    environment: process.env.NODE_ENV
  }
};
var logger = (0, import_pino.default)(
  pinoOptions,
  (0, import_pino_multi_stream.multistream)([{ stream: prettyStream }, { stream: streamToElastic }])
).child(childProperties);
var getCorrelationId2 = (ctx) => {
  var _a;
  return (_a = ctx.header["x-correlation-id"]) != null ? _a : (0, import_crypto.randomUUID)();
};
var middlewares = {
  pre: (ctx, next) => __async(void 0, null, function* () {
    var _a;
    let correlationId = getCorrelationId2(ctx);
    ctx.correlationId = correlationId;
    if (ctx.path !== "/health") {
      ctx.logger = logger.child({ correlationId: ctx.correlationId });
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
    }
    if (storage) {
      yield storage.run({ correlationId }, () => __async(void 0, null, function* () {
        return yield next();
      }));
    } else {
      return yield next();
    }
  }),
  post: (ctx, next) => __async(void 0, null, function* () {
    var _a;
    yield next();
    if (ctx.path !== "/health") {
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
    }
  })
};

// src/logging/loggedAxios.ts
var import_axios = __toESM(require("axios"));
var getCorrelationId3 = () => {
  if (storage && storage.getStore()) {
    const correlationId = storage.getStore().correlationId;
    return correlationId;
  }
  return null;
};
import_axios.default.interceptors.request.use((request) => {
  var _a;
  const correlationId = getCorrelationId3();
  if (correlationId) {
    request.headers["x-correlation-id"] = correlationId;
  }
  const requestFields = {
    url: request.url,
    headers: request.headers,
    method: request.method,
    correlationId: request.headers["x-correlation-id"]
  };
  logger.info(
    requestFields,
    `HTTP request: ${(_a = request.method) == null ? void 0 : _a.toUpperCase()} ${request.url}`
  );
  return request;
});
import_axios.default.interceptors.response.use((response) => {
  var _a;
  const correlationId = getCorrelationId3();
  const responseFields = {
    status: response.status,
    headers: response.headers,
    url: response.config.url,
    correlationId
  };
  logger.info(
    responseFields,
    `HTTP response: ${(_a = response.config.method) == null ? void 0 : _a.toUpperCase()} ${response.config.url} ${response.status}`
  );
  return response;
});
var loggedAxios_default = import_axios.default;

// src/index.ts
var axiosTypes = __toESM(require("axios"));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  axiosTypes,
  getCorrelationId,
  loggedAxios,
  logger,
  loggerMiddlewares,
  loggingStorage
});
//# sourceMappingURL=index.js.map
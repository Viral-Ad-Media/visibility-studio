import {
  defineConfig
} from "./chunk-UUSC66GK.mjs";
import "./chunk-SY723T7G.mjs";
import "./chunk-ZRT466PK.mjs";
import "./chunk-USHNXJ63.mjs";
import "./chunk-SN76735S.mjs";
import "./chunk-DHADIA3R.mjs";
import {
  init_esm
} from "./chunk-244PAGAH.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  project: "proj_chjzexdxabbzcdkuzbyl",
  runtime: "node",
  logLevel: "log",
  // Generous but bounded — a business audit can involve several
  // search+fetch round trips; this is a backstop against a runaway loop
  // burning API spend, not an expected normal duration.
  maxDuration: 300,
  dirs: ["./trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1e3,
      maxTimeoutInMs: 1e4,
      factor: 2,
      randomize: true
    }
  },
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map

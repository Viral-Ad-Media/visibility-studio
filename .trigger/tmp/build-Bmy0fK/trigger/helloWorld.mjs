import {
  task
} from "../chunk-NB3XQE7O.mjs";
import "../chunk-D3TXVDOZ.mjs";
import "../chunk-NHUSUXLY.mjs";
import "../chunk-USHNXJ63.mjs";
import "../chunk-SN76735S.mjs";
import "../chunk-DHADIA3R.mjs";
import {
  __name,
  init_esm
} from "../chunk-244PAGAH.mjs";

// trigger/helloWorld.ts
init_esm();
var helloWorld = task({
  id: "hello-world",
  run: /* @__PURE__ */ __name(async (payload) => {
    console.log("hello-world task running", payload);
    return { ok: true, echoedMessage: payload.message, ranAt: (/* @__PURE__ */ new Date()).toISOString() };
  }, "run")
});
export {
  helloWorld
};
//# sourceMappingURL=helloWorld.mjs.map

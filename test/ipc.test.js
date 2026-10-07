const assert = require("node:assert/strict");
const test = require("node:test");
const { allowedMethods, registerIpcHandlers } = require("../electron/ipc");

function makeHandler() {
  let registeredChannel;
  let registeredHandler;
  const serviceCalls = [];
  const ipcMain = {
    handle(channel, handler) {
      registeredChannel = channel;
      registeredHandler = handler;
    },
  };
  const service = { invoke: (...args) => serviceCalls.push(args) };
  registerIpcHandlers({
    ipcMain,
    getService: () => service,
    isAppFile: (url) => url.startsWith("file:///app/") && url.endsWith(".html"),
  });
  return { registeredChannel, registeredHandler, serviceCalls };
}

test("IPC invokes only allowlisted operations from the local main frame", async () => {
  const { registeredChannel, registeredHandler, serviceCalls } = makeHandler();
  const frame = { url: "file:///app/index.html" };
  const event = { senderFrame: frame, sender: { mainFrame: frame } };

  assert.equal(registeredChannel, "bodycomp:invoke");
  assert.ok(allowedMethods.has("workouts:create"));
  await registeredHandler(event, "workouts:list", []);
  assert.deepEqual(serviceCalls, [["workouts:list", []]]);
  await assert.rejects(registeredHandler(event, "fs:readFile", []), /Unsupported application operation/);

  const subframe = { url: frame.url };
  await assert.rejects(
    registeredHandler({ senderFrame: subframe, sender: { mainFrame: frame } }, "workouts:list", []),
    /main frame/,
  );
  const remoteFrame = { url: "https://example.com" };
  await assert.rejects(
    registeredHandler({ senderFrame: remoteFrame, sender: { mainFrame: remoteFrame } }, "workouts:list", []),
    /local app/,
  );
});

test("IPC refuses requests until the local service is ready", async () => {
  let handler;
  registerIpcHandlers({
    ipcMain: { handle: (_channel, registered) => { handler = registered; } },
    getService: () => null,
    isAppFile: () => true,
  });
  const frame = { url: "file:///app/index.html" };
  await assert.rejects(
    handler({ senderFrame: frame, sender: { mainFrame: frame } }, "workouts:list", []),
    /not ready/,
  );
});
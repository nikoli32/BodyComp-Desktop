const allowedMethods = new Set([
  "auth:register",
  "auth:login",
  "auth:logout",
  "auth:current-user",
  "profile:update",
  "profile:change-password",
  "profile:update-avatar",
  "recovery:get",
  "bodyweight:list",
  "bodyweight:create",
  "bodyweight:update",
  "bodyweight:delete",
  "exercises:list",
  "exercises:create",
  "custom-exercises:list",
  "custom-exercises:update",
  "custom-exercises:delete",
  "muscle-groups:list",
  "workouts:create",
  "workouts:list",
  "workouts:update",
  "workouts:delete",
  "settings:get",
  "settings:update",
  "backup:export",
  "backup:restore",
]);

function registerIpcHandlers({ ipcMain, getService, isAppFile }) {
  ipcMain.handle("bodycomp:invoke", async (event, method, args) => {
    if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
      throw new Error("IPC requests are only accepted from the main frame.");
    }
    if (!isAppFile(event.senderFrame.url)) {
      throw new Error("IPC requests are only accepted from the local app.");
    }
    if (!allowedMethods.has(method)) {
      throw new Error("Unsupported application operation.");
    }

    const service = getService();
    if (!service) throw new Error("The local data service is not ready.");
    return service.invoke(method, Array.isArray(args) ? args : []);
  });
}

module.exports = { allowedMethods, registerIpcHandlers };
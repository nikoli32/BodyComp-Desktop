(() => {
  let currentUser = null;

  function invoke(method, ...args) {
    if (!window.bodyCompDesktop) {
      return Promise.reject(
        new Error("The desktop data service is unavailable."),
      );
    }
    return window.bodyCompDesktop.invoke(method, ...args);
  }

  async function updateAvatar(formData) {
    const file = formData.get("avatar");
    if (!(file instanceof File)) throw new Error("Choose an image first.");
    return invoke("profile:update-avatar", {
      mimeType: file.type,
      data: await file.arrayBuffer(),
    });
  }

  async function getSettings() {
    const settings = await invoke("settings:get");
    let legacyUnit;
    try {
      legacyUnit = window.localStorage.getItem("bodycomp-weight-unit");
    } catch {
      return settings;
    }
    if (legacyUnit !== "lb" && legacyUnit !== "kg") return settings;

    const migrated = await invoke("settings:update", {
      weightUnit: legacyUnit,
    });
    try {
      window.localStorage.removeItem("bodycomp-weight-unit");
    } catch {}
    return migrated;
  }

  const api = {
    getRecovery: () => invoke("recovery:get"),
    getBodyweightMeasurements: () => invoke("bodyweight:list"),
    createBodyweightMeasurement: (measurement) =>
      invoke("bodyweight:create", measurement),
    updateBodyweightMeasurement: (id, measurement) =>
      invoke("bodyweight:update", id, measurement),
    deleteBodyweightMeasurement: (id) => invoke("bodyweight:delete", id),
    getExercises: () => invoke("exercises:list"),
    getCustomExercises: () => invoke("custom-exercises:list"),
    updateCustomExercise: (id, muscles) =>
      invoke("custom-exercises:update", id, muscles),
    deleteCustomExercise: (id) => invoke("custom-exercises:delete", id),
    getMuscleGroups: () => invoke("muscle-groups:list"),
    createExercise: (exercise) => invoke("exercises:create", exercise),
    createWorkout: (workout) => invoke("workouts:create", workout),
    getWorkouts: () => invoke("workouts:list"),
    updateWorkout: (id, workout) => invoke("workouts:update", id, workout),
    deleteWorkout: (id) => invoke("workouts:delete", id),
    getSettings,
    updateSettings: (settings) => invoke("settings:update", settings),
    exportBackup: (payload) => invoke("backup:export", payload),
    restoreBackup: (payload) => invoke("backup:restore", payload),
    getCurrentUser: async () => {
      currentUser = await invoke("auth:current-user");
      return currentUser;
    },
    isLoggedIn: () => Boolean(currentUser),
    register: async (account) => {
      currentUser = await invoke("auth:register", account);
      return currentUser;
    },
    login: async (credentials) => {
      currentUser = await invoke("auth:login", credentials);
      return currentUser;
    },
    logout: async () => {
      await invoke("auth:logout");
      currentUser = null;
    },
    updateAvatar,
    updateProfile: (profile) => invoke("profile:update", profile),
    changePassword: (payload) => invoke("profile:change-password", payload),
  };

  window.MuscleRecoveryApi = api;
})();

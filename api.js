(() => {
  const defaultApiUrl =
    window.location.protocol === "file:"
      ? "http://localhost:3000"
      : window.location.origin;
  const apiBaseUrl = (window.MUSCLE_RECOVERY_API_URL || defaultApiUrl).replace(
    /\/$/,
    "",
  );

  async function request(path, options = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (
        response.status === 401 &&
        !window.location.pathname.endsWith("auth.html")
      ) {
        window.location.assign("auth.html");
      }
      throw new Error(body.error || `Request failed (${response.status}).`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function getRecovery() {
    return request("/api/muscles/recovery");
  }

  async function getBodyweightMeasurements() {
    return request("/api/bodyweight");
  }

  async function createBodyweightMeasurement(measurement) {
    return request("/api/bodyweight", {
      method: "POST",
      body: JSON.stringify(measurement),
    });
  }

  async function updateBodyweightMeasurement(id, measurement) {
    return request(`/api/bodyweight/${id}`, {
      method: "PUT",
      body: JSON.stringify(measurement),
    });
  }

  async function deleteBodyweightMeasurement(id) {
    return request(`/api/bodyweight/${id}`, { method: "DELETE" });
  }

  async function getExercises() {
    return request("/api/exercises");
  }

  async function getCustomExercises() {
    return request("/api/custom-exercises");
  }

  async function updateCustomExercise(id, muscles) {
    return request(`/api/custom-exercises/${id}`, {
      method: "PUT",
      body: JSON.stringify({ muscles }),
    });
  }

  async function deleteCustomExercise(id) {
    return request(`/api/custom-exercises/${id}`, { method: "DELETE" });
  }

  async function getMuscleGroups() {
    return request("/api/muscle-groups");
  }

  async function createExercise(exercise) {
    return request("/api/exercises", {
      method: "POST",
      body: JSON.stringify(exercise),
    });
  }

  async function createWorkout(workout) {
    return request("/api/workouts", {
      method: "POST",
      body: JSON.stringify(workout),
    });
  }

  async function getWorkouts() {
    return request("/api/workouts");
  }

  async function updateWorkout(id, workout) {
    return request(`/api/workouts/${id}`, {
      method: "PUT",
      body: JSON.stringify(workout),
    });
  }

  async function deleteWorkout(id) {
    return request(`/api/workouts/${id}`, { method: "DELETE" });
  }

  window.MuscleRecoveryApi = {
    apiBaseUrl,
    getRecovery,
    getBodyweightMeasurements,
    createBodyweightMeasurement,
    updateBodyweightMeasurement,
    deleteBodyweightMeasurement,
    getExercises,
    getCustomExercises,
    updateCustomExercise,
    deleteCustomExercise,
    getMuscleGroups,
    createExercise,
    createWorkout,
    getWorkouts,
    updateWorkout,
    deleteWorkout,
    getCurrentUser: () => request("/api/auth/me"),
    register: (account) =>
      request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(account),
      }),
    login: (credentials) =>
      request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    logout: () => request("/api/auth/logout", { method: "POST" }),
    request,
  };
})();

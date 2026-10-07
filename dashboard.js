(() => {
  const totalGroups = document.querySelector("#totalGroups");
  const lastWorkout = document.querySelector("#lastWorkout");
  const statusMessage = document.querySelector("#apiStatus");

  function timeSince(date) {
    if (!date) return "None yet";
    const hours = Math.max(
      0,
      Math.round((Date.now() - new Date(date).getTime()) / 36e5),
    );
    return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
  }

  async function loadDashboard() {
    try {
      const recovery = await window.MuscleRecoveryApi.getRecovery();
      const freshGroups = recovery.filter(
        (muscle) => muscle.status === "ready",
      ).length;
      const latestWorkout = recovery.reduce(
        (latest, muscle) =>
          !muscle.lastTrainedAt ||
          (latest && new Date(muscle.lastTrainedAt) <= new Date(latest))
            ? latest
            : muscle.lastTrainedAt,
        null,
      );
      totalGroups.textContent = freshGroups;
      lastWorkout.textContent = timeSince(latestWorkout);
      statusMessage.textContent = `${freshGroups} of ${recovery.length} groups are ready to train.`;
    } catch (error) {
      totalGroups.textContent = "—";
      lastWorkout.textContent = "—";
      statusMessage.textContent =
        error.message || "Unable to load local recovery data.";
      console.error(error);
    }
  }
  loadDashboard();
})();

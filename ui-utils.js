(function exposeUiUtils(global) {
  function nextMuscleIndex(currentIndex, direction, length) {
    if (!length) return -1;
    if (direction === "first") return 0;
    if (direction === "last") return length - 1;
    if (currentIndex < 0) return direction === "previous" ? length - 1 : 0;
    return direction === "previous"
      ? (currentIndex - 1 + length) % length
      : (currentIndex + 1) % length;
  }

  function recoveryLabel(status) {
    if (status === "ready") return "ready to train";
    if (status === "needs_recovery") return "recovering";
    return "recovery status loading";
  }

  const poundsPerKilogram = 2.20462262185;

  function leanMassKg(weightKg, bodyFatPercent) {
    return Math.round(weightKg * (1 - bodyFatPercent / 100) * 100) / 100;
  }

  function weightToKg(weight, unit) {
    const weightKg = unit === "lb" ? weight / poundsPerKilogram : weight;
    return Math.round(weightKg * 100) / 100;
  }

  function weightFromKg(weightKg, unit) {
    const weight = unit === "lb" ? weightKg * poundsPerKilogram : weightKg;
    return Math.round(weight * 100) / 100;
  }

  const api = {
    nextMuscleIndex,
    recoveryLabel,
    leanMassKg,
    weightToKg,
    weightFromKg,
  };
  if (typeof module !== "undefined") module.exports = api;
  global.MuscleMapUtils = api;
})(typeof window === "undefined" ? globalThis : window);

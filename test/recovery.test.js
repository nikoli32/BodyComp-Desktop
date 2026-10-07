const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateMuscleRecovery,
  calculateSetStimulus,
  combineDemands,
  estimateOneRepMax,
  estimateRecoveryDuration,
  estimateTransitionHours,
} = require("../electron/recovery");
const { recoveryLabel } = require("../ui-utils");

test("strength estimate uses Epley with effective reps and a default RIR of 2", () => {
  assert.equal(estimateOneRepMax(60, 8, 2), 84);
  assert.equal(estimateOneRepMax(60, 8), 84);
  assert.ok(Math.abs(estimateOneRepMax(60, 1, 10) - 62) < 1e-9);
  assert.equal(estimateOneRepMax(null, 8, 2), null);
});

test("set stimulus responds to effort and exercise-muscle load factor", () => {
  const easySet = calculateSetStimulus({ weightKg: 60, reps: 8, rir: 8 });
  const hardSet = calculateSetStimulus({ weightKg: 60, reps: 8, rir: 1 });
  const reducedLoad = calculateSetStimulus({
    weightKg: 60,
    reps: 8,
    rir: 1,
    loadFactor: 0.5,
  });
  assert.ok(hardSet > easySet);
  assert.ok(reducedLoad < hardSet);
});

test("workout sessions combine multiplicatively and decay linearly", () => {
  assert.equal(combineDemands([50, 50]), 75);
  const now = Date.parse("2026-10-06T12:00:00.000Z");
  const recovery = calculateMuscleRecovery(
    [
      {
        startedAt: new Date(now - 24 * 3_600_000).toISOString(),
        lastTrainedAt: new Date(now - 24 * 3_600_000).toISOString(),
        stimulus: 60,
        recoveryHours: 48,
      },
    ],
    now,
  );
  assert.equal(recovery.recoveryDemand, 30);
  assert.equal(recovery.status, "needs_recovery");
  assert.equal(recovery.estimatedReadyAt, "2026-10-06T20:00:00.000Z");
});

test("recovery duration learns from the median after three valid transitions", () => {
  const coldStart = estimateRecoveryDuration([24, 30]);
  assert.equal(coldStart.recoveryHours, 48);
  assert.equal(coldStart.recoveryEstimateLearned, false);
  const learned = estimateRecoveryDuration([24, 48, 72, 96]);
  assert.equal(learned.recoveryHours, 60);
  assert.equal(learned.recoveryHistorySamples, 4);
  assert.equal(learned.recoveryEstimateLearned, true);
  assert.equal(estimateTransitionHours(100, 100, 36), 36);
  assert.ok(estimateTransitionHours(100, 80, 36) > 36);
});

test("recovery labels cover the binary service statuses", () => {
  assert.equal(recoveryLabel("ready"), "ready to train");
  assert.equal(recoveryLabel("needs_recovery"), "recovering");
  for (const status of ["needs_recovery", "light", "moderate", "high"]) {
    assert.equal(recoveryLabel(status), "recovering");
  }
});

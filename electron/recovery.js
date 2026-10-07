const DEFAULT_RECOVERY_HOURS = 48;
const MIN_RECOVERY_HOURS = 18;
const MAX_RECOVERY_HOURS = 96;
const MIN_LEARNING_TRANSITIONS = 3;
const READY_DEMAND_THRESHOLD = 20;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function estimateOneRepMax(weightKg, reps, rir) {
  const weight = Number(weightKg);
  const repetitionCount = Number(reps);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  if (!Number.isFinite(repetitionCount) || repetitionCount <= 0) return null;

  const hasRir = rir !== null && rir !== undefined && rir !== "";
  const reserve =
    hasRir && Number.isFinite(Number(rir)) ? clamp(Number(rir), 0, 10) : 2;
  const effectiveReps = clamp(repetitionCount + (10 - reserve), 1, 12);
  return weight * (1 + effectiveReps / 30);
}

function calculateSetStimulus({ weightKg, reps, rir, loadFactor = 1 }) {
  const oneRepMax = estimateOneRepMax(weightKg, reps, rir);
  if (oneRepMax === null) return 0;

  const weight = Number(weightKg);
  const hasRir = rir !== null && rir !== undefined && rir !== "";
  const reserve =
    hasRir && Number.isFinite(Number(rir)) ? clamp(Number(rir), 0, 10) : 2;
  const effectiveReps = clamp(Number(reps) + (10 - reserve), 1, 12);
  const factor = Number.isFinite(Number(loadFactor))
    ? clamp(Number(loadFactor), 0.1, 2)
    : 1;
  const relativeIntensity = weight / oneRepMax;
  const effortFactor = 1 + (10 - reserve) / 10;
  const repetitionFactor = effectiveReps / 12;

  return clamp(
    14 * relativeIntensity * effortFactor * repetitionFactor * factor,
    0,
    70,
  );
}

function combineDemands(demands) {
  const remaining = demands.reduce(
    (product, demand) =>
      product * (1 - clamp(Number(demand) || 0, 0, 100) / 100),
    1,
  );
  return 100 * (1 - remaining);
}

function sessionDemandAt(session, atMilliseconds) {
  const startedAt = Date.parse(session.startedAt);
  const recoveryHours = clamp(
    Number(session.recoveryHours) || DEFAULT_RECOVERY_HOURS,
    MIN_RECOVERY_HOURS,
    MAX_RECOVERY_HOURS,
  );
  const ageHours = Math.max(0, (atMilliseconds - startedAt) / 3_600_000);
  const remainingFraction = Math.max(0, 1 - ageHours / recoveryHours);
  return clamp(Number(session.stimulus) || 0, 0, 100) * remainingFraction;
}

function demandAfterHours(sessions, nowMilliseconds, additionalHours) {
  return combineDemands(
    sessions.map((session) =>
      sessionDemandAt(session, nowMilliseconds + additionalHours * 3_600_000),
    ),
  );
}

function findEstimatedReadyAt(sessions, nowMilliseconds) {
  if (
    demandAfterHours(sessions, nowMilliseconds, 0) <= READY_DEMAND_THRESHOLD
  ) {
    return new Date(nowMilliseconds).toISOString();
  }

  let low = 0;
  let high = MAX_RECOVERY_HOURS;
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const middle = (low + high) / 2;
    if (
      demandAfterHours(sessions, nowMilliseconds, middle) <=
      READY_DEMAND_THRESHOLD
    ) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return new Date(nowMilliseconds + high * 3_600_000).toISOString();
}

function estimateTransitionHours(previousStrength, nextStrength, elapsedHours) {
  const previous = Number(previousStrength);
  const next = Number(nextStrength);
  const elapsed = Number(elapsedHours);
  if (
    !Number.isFinite(previous) ||
    previous <= 0 ||
    !Number.isFinite(next) ||
    next <= 0 ||
    !Number.isFinite(elapsed) ||
    elapsed <= 0
  )
    return null;

  const performanceRatio = next / previous;
  const declinePenalty =
    performanceRatio < 0.98 ? (1 - performanceRatio) * 36 : 0;
  return clamp(
    elapsed + declinePenalty,
    MIN_RECOVERY_HOURS,
    MAX_RECOVERY_HOURS,
  );
}

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function estimateRecoveryDuration(transitions) {
  const validTransitions = transitions
    .map(Number)
    .filter((hours) => Number.isFinite(hours) && hours > 0)
    .map((hours) => clamp(hours, MIN_RECOVERY_HOURS, MAX_RECOVERY_HOURS));
  const learned = validTransitions.length >= MIN_LEARNING_TRANSITIONS;
  return {
    recoveryHours: learned ? median(validTransitions) : DEFAULT_RECOVERY_HOURS,
    recoveryEstimateLearned: learned,
    recoveryHistorySamples: validTransitions.length,
  };
}

function calculateMuscleRecovery(sessions, nowMilliseconds = Date.now()) {
  const recoveryDemand = Math.round(
    demandAfterHours(sessions, nowMilliseconds, 0),
  );
  const lastTrainedAt = sessions.length
    ? sessions
        .map((session) => session.lastTrainedAt || session.startedAt)
        .sort((left, right) => Date.parse(right) - Date.parse(left))[0]
    : null;
  return {
    recoveryDemand,
    status:
      recoveryDemand <= READY_DEMAND_THRESHOLD ? "ready" : "needs_recovery",
    lastTrainedAt,
    estimatedReadyAt: findEstimatedReadyAt(sessions, nowMilliseconds),
  };
}

module.exports = {
  DEFAULT_RECOVERY_HOURS,
  MAX_RECOVERY_HOURS,
  MIN_RECOVERY_HOURS,
  MIN_LEARNING_TRANSITIONS,
  READY_DEMAND_THRESHOLD,
  calculateMuscleRecovery,
  calculateSetStimulus,
  combineDemands,
  estimateOneRepMax,
  estimateRecoveryDuration,
  estimateTransitionHours,
};

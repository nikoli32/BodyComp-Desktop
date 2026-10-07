(() => {
  const form = document.querySelector("#workoutForm");
  const picker = document.querySelector("#exercisePicker");
  const addExercise = document.querySelector("#addExercise");
  const exerciseList = document.querySelector("#workoutExercises");
  const emptyState = document.querySelector("#workoutEmpty");
  const finishButton = document.querySelector("#finishWorkout");
  const status = document.querySelector("#workoutStatus");
  const notes = document.querySelector("#workoutNotes");
  const customExerciseForm = document.querySelector("#customExerciseForm");
  const customExerciseName = document.querySelector("#customExerciseName");
  const customMuscleRows = document.querySelector("#customMuscleRows");
  const toggleCustomExercise = document.querySelector("#toggleCustomExercise");
  const addPrimaryMuscle = document.querySelector("#addPrimaryMuscle");
  const addSecondaryMuscle = document.querySelector("#addSecondaryMuscle");
  const saveCustomExercise = document.querySelector("#saveCustomExercise");
  const customExerciseStatus = document.querySelector("#customExerciseStatus");
  const workoutStartedAt = new Date().toISOString();
  let exercises = [];
  let muscleGroups = [];
  let workoutExercises = [];
  let customMuscleAssignments = [];

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = `form-status ${kind}`;
  }

  function setCustomExerciseStatus(message, kind = "") {
    customExerciseStatus.textContent = message;
    customExerciseStatus.className = `form-status ${kind}`;
  }

  function renderCustomMuscleRows() {
    customMuscleRows.innerHTML = "";
    customMuscleAssignments.forEach((assignment, index) => {
      const row = document.createElement("div");
      row.className = "custom-muscle-row";
      const label = document.createElement("label");
      label.textContent = assignment.role === "primary" ? "Primary muscle" : "Secondary muscle";
      const select = document.createElement("select");
      select.name = `custom-muscle-${index}`;
      select.setAttribute("aria-label", `${assignment.role} muscle ${index + 1}`);
      select.innerHTML = '<option value="">Select a muscle</option>' + muscleGroups.map((group) => `<option value="${group.id}">${group.name}</option>`).join("");
      if (assignment.muscleGroupId !== "") select.value = String(assignment.muscleGroupId);
      select.addEventListener("change", (event) => {
        assignment.muscleGroupId = event.target.value;
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-muscle-button";
      removeButton.textContent = "Remove";
      removeButton.disabled = customMuscleAssignments.length <= 1;
      removeButton.addEventListener("click", () => {
        if (customMuscleAssignments.length <= 1) return;
        customMuscleAssignments = customMuscleAssignments.filter((_, rowIndex) => rowIndex !== index);
        renderCustomMuscleRows();
      });

      label.append(select);
      row.append(label, removeButton);
      customMuscleRows.append(row);
    });
  }

  function addCustomMuscleRow(role) {
    customMuscleAssignments.push({ role, muscleGroupId: "" });
    renderCustomMuscleRows();
  }

  function resetCustomExerciseForm() {
    customExerciseName.value = "";
    customMuscleAssignments = [{ role: "primary", muscleGroupId: "" }];
    renderCustomMuscleRows();
    customExerciseForm.hidden = true;
    setCustomExerciseStatus("");
  }

  function addSet(exercise) {
    exercise.sets.push({ weight: "", reps: "", rir: "" });
    renderWorkout();
  }

  function setExerciseSetCount(exercise, count) {
    const targetCount = Number(count);
    if (!Number.isInteger(targetCount) || targetCount < 1) return;
    while (exercise.sets.length < targetCount) exercise.sets.push({ weight: "", reps: "", rir: "" });
    exercise.sets.length = targetCount;
    renderWorkout();
  }

  function changeWeightUnit(exercise, nextUnit) {
    if (exercise.weightUnit === nextUnit) return;
    const factor = nextUnit === "lb" ? 2.2046226218 : 0.45359237;
    exercise.sets.forEach((set) => {
      if (set.weight !== "") set.weight = String(Math.round(Number(set.weight) * factor * 100) / 100);
    });
    exercise.weightUnit = nextUnit;
    renderWorkout();
  }

  function addSelectedExercise() {
    const selected = exercises.find((exercise) => String(exercise.id) === picker.value);
    if (!selected) {
      setStatus("Select an exercise before adding it.", "error");
      return;
    }
    workoutExercises.push({ ...selected, localId: window.crypto?.randomUUID?.() || String(Date.now() + Math.random()), weightUnit: "kg", sets: [{ weight: "", reps: "", rir: "" }] });
    setStatus("");
    renderWorkout();
  }

  function renderWorkout() {
    exerciseList.innerHTML = "";
    emptyState.hidden = workoutExercises.length > 0;
    finishButton.disabled = workoutExercises.length === 0;
    workoutExercises.forEach((exercise) => {
      const card = document.createElement("section");
      card.className = "exercise-card";
      card.innerHTML = `
        <header class="exercise-card-header">
          <div><h3>${exercise.name}</h3><p>${exercise.muscles.map((muscle) => muscle.name).join(" · ")}</p></div>
          <button class="text-button remove-exercise" type="button">Remove</button>
        </header>
        <div class="set-entry-controls">
          <label>Number of sets <input class="set-count" aria-label="${exercise.name} number of sets" type="number" min="1" step="1" value="${exercise.sets.length}" required></label>
          <label>Weight unit <select class="weight-unit" aria-label="${exercise.name} weight unit"><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label>
        </div>
        <div class="set-table" role="group" aria-label="${exercise.name} sets">
          <div class="set-header"><span>Set</span><span>Weight (${exercise.weightUnit})</span><span>Reps</span><span>RIR</span><span></span></div>
          <div class="set-rows"></div>
        </div>
        <button class="text-button add-set" type="button">+ Add set</button>`;
      card.querySelector(".remove-exercise").addEventListener("click", () => {
        workoutExercises = workoutExercises.filter((item) => item.localId !== exercise.localId);
        renderWorkout();
      });
      card.querySelector(".add-set").addEventListener("click", () => addSet(exercise));
      card.querySelector(".set-count").addEventListener("change", (event) => setExerciseSetCount(exercise, event.target.value));
      const weightUnit = card.querySelector(".weight-unit");
      weightUnit.value = exercise.weightUnit;
      weightUnit.addEventListener("change", (event) => changeWeightUnit(exercise, event.target.value));
      const rows = card.querySelector(".set-rows");
      exercise.sets.forEach((set, index) => {
        const row = document.createElement("div");
        row.className = "set-row";
        row.innerHTML = `<span>${index + 1}</span><input aria-label="Set ${index + 1} weight in kilograms" type="number" min="0" step="0.5" value="${set.weightKg}" placeholder="Optional"><input aria-label="Set ${index + 1} repetitions" type="number" min="1" step="1" value="${set.reps}" required><input aria-label="Set ${index + 1} reps in reserve" type="number" min="0" max="10" step="1" value="${set.rir}" placeholder="Optional"><button class="remove-set" type="button" aria-label="Remove set ${index + 1}">×</button>`;
        const inputs = row.querySelectorAll("input");
        inputs[0].value = set.weight;
        inputs[0].required = true;
        inputs[0].setAttribute("aria-label", `Set ${index + 1} weight in ${exercise.weightUnit === "lb" ? "pounds" : "kilograms"}`);
        ["weight", "reps", "rir"].forEach((field, fieldIndex) => inputs[fieldIndex].addEventListener("input", (event) => { set[field] = event.target.value; }));
        row.querySelector(".remove-set").addEventListener("click", () => {
          exercise.sets.splice(index, 1);
          if (!exercise.sets.length) workoutExercises = workoutExercises.filter((item) => item.localId !== exercise.localId);
          renderWorkout();
        });
        rows.append(row);
      });
      exerciseList.append(card);
    });
  }

  function workoutPayload() {
    return {
      startedAt: workoutStartedAt,
      finishedAt: new Date().toISOString(),
      notes: notes.value.trim() || undefined,
      exercises: workoutExercises.map((exercise) => ({
        exerciseId: Number(exercise.id),
        sets: exercise.sets.map((set) => ({
          weightKg: set.weight === "" ? undefined : Number(set.weight) * (exercise.weightUnit === "lb" ? 0.45359237 : 1),
          reps: Number(set.reps),
          rir: set.rir === "" ? undefined : Number(set.rir),
          completedAt: new Date().toISOString(),
        })),
      })),
    };
  }

  async function loadExercises() {
    try {
      exercises = await window.MuscleRecoveryApi.getExercises();
      picker.innerHTML = '<option value="">Select an exercise</option>' + exercises.map((exercise) => `<option value="${exercise.id}">${exercise.name}</option>`).join("");
      picker.disabled = false;
      addExercise.disabled = false;
    } catch (error) {
      picker.innerHTML = "<option>Unable to load exercises</option>";
      setStatus(error.message || "Unable to load local exercises.", "error");
      console.error(error);
    }
  }

  async function loadMuscleGroups() {
    try {
      muscleGroups = await window.MuscleRecoveryApi.getMuscleGroups();
      renderCustomMuscleRows();
    } catch (error) {
      console.error(error);
      setCustomExerciseStatus("Unable to load muscle groups for custom workouts.", "error");
    }
  }

  addExercise.addEventListener("click", addSelectedExercise);
  toggleCustomExercise.addEventListener("click", () => {
    customExerciseForm.hidden = !customExerciseForm.hidden;
    if (!customExerciseForm.hidden) {
      customExerciseName.focus();
      setCustomExerciseStatus("");
      renderCustomMuscleRows();
    }
  });
  addPrimaryMuscle.addEventListener("click", () => addCustomMuscleRow("primary"));
  addSecondaryMuscle.addEventListener("click", () => addCustomMuscleRow("secondary"));

  async function saveCustomWorkout() {
    const name = customExerciseName.value.trim();
    const muscles = customMuscleAssignments
      .map((assignment) => assignment.muscleGroupId ? { muscleGroupId: Number(assignment.muscleGroupId), role: assignment.role } : null)
      .filter(Boolean);

    if (!name) {
      setCustomExerciseStatus("Give your workout a name before saving.", "error");
      return;
    }
    if (!muscles.some((muscle) => muscle.role === "primary")) {
      setCustomExerciseStatus("Choose at least one primary muscle target.", "error");
      return;
    }
    if (new Set(muscles.map((muscle) => muscle.muscleGroupId)).size !== muscles.length) {
      setCustomExerciseStatus("Each muscle group can only be assigned once.", "error");
      return;
    }

    setCustomExerciseStatus("Saving custom workout…");
    try {
      const created = await window.MuscleRecoveryApi.createExercise({ name, muscles });
      exercises = [...exercises, created];
      picker.innerHTML = '<option value="">Select an exercise</option>' + exercises.map((exercise) => `<option value="${exercise.id}">${exercise.name}</option>`).join("");
      picker.value = String(created.id);
      addExercise.disabled = false;
      resetCustomExerciseForm();
      setCustomExerciseStatus("Custom workout saved and ready to add.", "success");
    } catch (error) {
      setCustomExerciseStatus(error.message || "Unable to save custom workout.", "error");
      console.error(error);
    }
  }

  function validateWorkout() {
    if (!workoutExercises.length) {
      setStatus("Add at least one exercise before finishing your workout.", "error");
      return false;
    }
    for (const exercise of workoutExercises) {
      for (const [setIndex, set] of exercise.sets.entries()) {
        const weight = Number(set.weight);
        const reps = Number(set.reps);
        if (set.weight === "" || !Number.isFinite(weight) || weight < 0 || set.reps === "" || !Number.isInteger(reps) || reps < 1) {
          setStatus(`Enter a valid weight and rep count for ${exercise.name}, set ${setIndex + 1}.`, "error");
          return false;
        }
      }
    }
    return true;
  }

  saveCustomExercise.addEventListener("click", saveCustomWorkout);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateWorkout()) return;
    finishButton.disabled = true;
    setStatus("Saving workout…");
    try {
      await window.MuscleRecoveryApi.createWorkout(workoutPayload());
      setStatus("Workout saved. Updating your recovery map…", "success");
      window.setTimeout(() => { window.location.assign("front_view.html?workoutSaved=1"); }, 650);
    } catch (error) {
      finishButton.disabled = false;
      setStatus(error.message || "Unable to save workout.", "error");
      console.error(error);
    }
  });

  loadMuscleGroups();
  loadExercises();
})();

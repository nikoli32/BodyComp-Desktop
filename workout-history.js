(() => {
  const list = document.querySelector("#workoutHistory");
  const status = document.querySelector("#historyStatus");
  let workouts = [];
  let exercises = [];

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = `form-status ${kind}`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unscheduled workout";
    return date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function dateTimeInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function isBlank(value) {
    return value === "" || value === null || value === undefined;
  }

  function optionalNumber(value) {
    return isBlank(value) ? undefined : Number(value);
  }

  function workoutPayload(workout) {
    const startedAt = new Date(workout.startedAt).toISOString();
    const finishedAt = workout.finishedAt
      ? new Date(workout.finishedAt).toISOString()
      : undefined;
    const oldAnchor = new Date(
      workout.finishedAt || workout.startedAt,
    ).getTime();
    const newAnchor = new Date(finishedAt || startedAt).getTime();
    return {
      startedAt,
      finishedAt,
      notes: (workout.notes || "").trim() || undefined,
      exercises: workout.exercises.map((exercise) => ({
        exerciseId: Number(exercise.exerciseId),
        notes: (exercise.notes || "").trim() || undefined,
        sets: exercise.sets.map((set) => ({
          weightKg: optionalNumber(set.weightKg),
          reps: optionalNumber(set.reps),
          durationSeconds: optionalNumber(set.durationSeconds),
          rir: optionalNumber(set.rir),
          completedAt: new Date(
            newAnchor +
              (set.completedAt
                ? new Date(set.completedAt).getTime() - oldAnchor
                : 0),
          ).toISOString(),
        })),
      })),
    };
  }

  function isValid(workout) {
    const startedAt = new Date(workout.startedAt);
    const finishedAt = workout.finishedAt ? new Date(workout.finishedAt) : null;
    if (
      Number.isNaN(startedAt.getTime()) ||
      (finishedAt &&
        (Number.isNaN(finishedAt.getTime()) || finishedAt < startedAt))
    )
      return false;
    if (!workout.exercises.length) return false;
    return workout.exercises.every((exercise) => {
      if (
        !Number.isInteger(Number(exercise.exerciseId)) ||
        !exercise.sets.length
      )
        return false;
      return exercise.sets.every((set) => {
        const weightValid =
          isBlank(set.weightKg) ||
          (Number.isFinite(Number(set.weightKg)) && Number(set.weightKg) >= 0);
        const repsValid =
          isBlank(set.reps) ||
          (Number.isInteger(Number(set.reps)) && Number(set.reps) > 0);
        const durationValid =
          isBlank(set.durationSeconds) ||
          (Number.isInteger(Number(set.durationSeconds)) &&
            Number(set.durationSeconds) > 0);
        const rirValid =
          isBlank(set.rir) ||
          (Number.isInteger(Number(set.rir)) &&
            Number(set.rir) >= 0 &&
            Number(set.rir) <= 10);
        return (
          weightValid &&
          repsValid &&
          durationValid &&
          rirValid &&
          (!isBlank(set.reps) || !isBlank(set.durationSeconds))
        );
      });
    });
  }

  function makeField(labelText, type, value, attributes = {}) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = type;
    input.value = value ?? "";
    Object.entries(attributes).forEach(([name, attributeValue]) =>
      input.setAttribute(name, attributeValue),
    );
    label.append(input);
    return { label, input };
  }

  function createSet() {
    return {
      weightKg: "",
      reps: "",
      durationSeconds: "",
      rir: "",
      completedAt: null,
    };
  }

  function addExercise(workout, exerciseId) {
    const exercise = exercises.find(
      (option) => String(option.id) === String(exerciseId),
    );
    if (!exercise) return;
    workout.exercises.push({
      exerciseId: exercise.id,
      name: exercise.name,
      notes: "",
      sets: [createSet()],
    });
    render();
  }

  function render() {
    list.innerHTML = "";
    if (!workouts.length) {
      list.innerHTML =
        '<p class="empty-state">No workouts saved yet. Log a workout to see it here.</p>';
      return;
    }
    workouts.forEach((workout) => {
      const card = document.createElement("article");
      card.className = "exercise-card history-card";
      card.innerHTML = `<header class="exercise-card-header"><div><h3>${formatDate(workout.startedAt)}</h3><p>${workout.exercises.length} exercise${workout.exercises.length === 1 ? "" : "s"}</p></div><button class="button save-history" type="button">Save changes</button><button class="button button-secondary delete-history" type="button">Delete</button></header><div class="history-session-fields"></div><label class="notes-field">Workout notes<textarea class="history-notes" maxlength="2000" placeholder="Optional notes"></textarea></label><div class="history-exercises"></div><div class="history-actions"><div class="history-add-exercise"><select class="add-exercise-picker" aria-label="Choose an exercise to add"></select><button class="button button-secondary add-history-exercise" type="button">Add exercise</button></div><p class="form-status history-status" role="status"></p></div>`;
      const sessionFields = card.querySelector(".history-session-fields");
      const startedField = makeField(
        "Started",
        "datetime-local",
        dateTimeInput(workout.startedAt),
        { required: "" },
      );
      const finishedField = makeField(
        "Finished",
        "datetime-local",
        dateTimeInput(workout.finishedAt),
      );
      startedField.input.addEventListener("input", (event) => {
        workout.startedAt = event.target.value;
      });
      finishedField.input.addEventListener("input", (event) => {
        workout.finishedAt = event.target.value || null;
      });
      sessionFields.append(startedField.label, finishedField.label);

      const notes = card.querySelector(".history-notes");
      notes.value = workout.notes || "";
      notes.addEventListener("input", (event) => {
        workout.notes = event.target.value;
      });

      const exerciseList = card.querySelector(".history-exercises");
      workout.exercises.forEach((exercise) => {
        const section = document.createElement("section");
        section.className = "history-exercise";
        section.innerHTML = `<div class="history-exercise-header"><label>Exercise<select class="history-exercise-picker"></select></label><button class="text-button remove-history-exercise" type="button">Remove exercise</button></div><label class="notes-field">Exercise notes<textarea class="history-exercise-notes" maxlength="1000" placeholder="Optional notes"></textarea></label><div class="set-table"><div class="set-header"><span>Set</span><span>Weight (kg)</span><span>Reps</span><span>Duration (sec)</span><span>RIR</span><span></span></div><div class="set-rows"></div></div><button class="text-button add-history-set" type="button">+ Add set</button>`;
        const picker = section.querySelector(".history-exercise-picker");
        exercises.forEach((option) => {
          const element = document.createElement("option");
          element.value = String(option.id);
          element.textContent = option.name;
          picker.append(element);
        });
        if (
          !exercises.some(
            (option) => String(option.id) === String(exercise.exerciseId),
          )
        ) {
          const current = document.createElement("option");
          current.value = String(exercise.exerciseId);
          current.textContent = exercise.name;
          picker.append(current);
        }
        picker.value = String(exercise.exerciseId);
        picker.addEventListener("change", (event) => {
          const selected = exercises.find(
            (option) => String(option.id) === event.target.value,
          );
          if (!selected) return;
          exercise.exerciseId = selected.id;
          exercise.name = selected.name;
        });
        const exerciseNotes = section.querySelector(".history-exercise-notes");
        exerciseNotes.value = exercise.notes || "";
        exerciseNotes.addEventListener("input", (event) => {
          exercise.notes = event.target.value;
        });
        section
          .querySelector(".remove-history-exercise")
          .addEventListener("click", () => {
            workout.exercises = workout.exercises.filter(
              (item) => item !== exercise,
            );
            render();
          });
        section
          .querySelector(".add-history-set")
          .addEventListener("click", () => {
            exercise.sets.push(createSet());
            render();
          });
        const rows = section.querySelector(".set-rows");
        exercise.sets.forEach((set, index) => {
          const row = document.createElement("div");
          row.className = "set-row history-set-row";
          row.innerHTML = `<span>${index + 1}</span>`;
          const fields = [
            [
              "weightKg",
              "Weight in kilograms",
              "number",
              { min: "0", step: "0.5" },
            ],
            ["reps", "Reps", "number", { min: "1", step: "1" }],
            [
              "durationSeconds",
              "Duration in seconds",
              "number",
              { min: "1", step: "1" },
            ],
            [
              "rir",
              "Reps in reserve",
              "number",
              { min: "0", max: "10", step: "1" },
            ],
          ];
          fields.forEach(([field, label, type, attributes]) => {
            const input = document.createElement("input");
            input.type = type;
            input.value = set[field] ?? "";
            Object.entries(attributes).forEach(([name, value]) =>
              input.setAttribute(name, value),
            );
            input.setAttribute(
              "aria-label",
              `${exercise.name} set ${index + 1} ${label}`,
            );
            input.addEventListener("input", (event) => {
              set[field] = event.target.value;
            });
            row.append(input);
          });
          const removeSet = document.createElement("button");
          removeSet.className = "remove-set";
          removeSet.type = "button";
          removeSet.textContent = "×";
          removeSet.setAttribute(
            "aria-label",
            `Remove ${exercise.name} set ${index + 1}`,
          );
          removeSet.disabled = exercise.sets.length === 1;
          removeSet.addEventListener("click", () => {
            exercise.sets.splice(index, 1);
            render();
          });
          row.append(removeSet);
          rows.append(row);
        });
        exerciseList.append(section);
      });

      const cardStatus = card.querySelector(".history-status");
      const exercisePicker = card.querySelector(".add-exercise-picker");
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = exercises.length
        ? "Select an exercise"
        : "Exercise catalog unavailable";
      exercisePicker.append(placeholder);
      exercises.forEach((exercise) => {
        const option = document.createElement("option");
        option.value = String(exercise.id);
        option.textContent = exercise.name;
        exercisePicker.append(option);
      });
      card.querySelector(".add-history-exercise").disabled =
        exercises.length === 0;
      card
        .querySelector(".add-history-exercise")
        .addEventListener("click", () =>
          addExercise(workout, exercisePicker.value),
        );
      card
        .querySelector(".save-history")
        .addEventListener("click", async () => {
          if (!isValid(workout)) {
            cardStatus.textContent =
              "Check the session times and enter valid set data. Each set needs reps or a duration; RIR must be 0–10.";
            cardStatus.className = "form-status history-status error";
            return;
          }
          const button = card.querySelector(".save-history");
          button.disabled = true;
          cardStatus.textContent = "Saving changes...";
          cardStatus.className = "form-status history-status";
          try {
            const payload = workoutPayload(workout);
            await window.MuscleRecoveryApi.updateWorkout(workout.id, payload);
            workout.startedAt = payload.startedAt;
            workout.finishedAt = payload.finishedAt || null;
            workout.notes = payload.notes || "";
            workout.exercises = payload.exercises.map(
              (saved, exerciseIndex) => ({
                ...workout.exercises[exerciseIndex],
                ...saved,
                sets: saved.sets,
              }),
            );
            cardStatus.textContent =
              "Workout updated. Recovery map data has been recalculated.";
            cardStatus.className = "form-status history-status success";
          } catch (error) {
            cardStatus.textContent = error.message || "Unable to save changes.";
            cardStatus.className = "form-status history-status error";
          } finally {
            button.disabled = false;
          }
        });
      card.querySelector(".delete-history").addEventListener("click", () => {
        if (!window.confirm("Delete this workout and its exercises and sets?"))
          return;
        window.MuscleRecoveryApi.deleteWorkout(workout.id)
          .then(() => {
            workouts = workouts.filter((item) => item.id !== workout.id);
            render();
          })
          .catch((error) => {
            cardStatus.textContent =
              error.message || "Unable to delete workout.";
            cardStatus.className = "form-status history-status error";
          });
      });
      list.append(card);
    });
  }

  async function load() {
    try {
      const [savedWorkouts, catalog] = await Promise.all([
        window.MuscleRecoveryApi.getWorkouts(),
        window.MuscleRecoveryApi.getExercises().catch(() => []),
      ]);
      workouts = savedWorkouts;
      exercises = catalog;
      setStatus(
        exercises.length
          ? ""
          : "Exercise catalog unavailable. Existing sessions can still be edited; adding exercises is disabled.",
      );
      render();
    } catch (error) {
      setStatus(error.message || "Unable to load workout history.", "error");
    }
  }

  load();
})();

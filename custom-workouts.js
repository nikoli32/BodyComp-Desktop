(() => {
  const status = document.querySelector("#customWorkoutsStatus");
  const workoutList = document.querySelector("#customWorkoutList");
  let muscleGroups = [];

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = `form-status ${kind}`;
  }

  function createAssignmentRow(assignment, assignments, renderRows) {
    const row = document.createElement("div");
    row.className = "custom-workout-assignment-row";

    const muscleLabel = document.createElement("label");
    muscleLabel.textContent = "Muscle group";
    const muscleSelect = document.createElement("select");
    muscleSelect.setAttribute("aria-label", "Muscle group");
    muscleSelect.add(new Option("Select a muscle", ""));
    muscleGroups.forEach((group) => {
      muscleSelect.add(new Option(group.name, String(group.id)));
    });
    muscleSelect.value = assignment.muscleGroupId
      ? String(assignment.muscleGroupId)
      : "";
    muscleSelect.addEventListener("change", () => {
      assignment.muscleGroupId = muscleSelect.value
        ? Number(muscleSelect.value)
        : "";
    });
    muscleLabel.append(muscleSelect);

    const roleLabel = document.createElement("label");
    roleLabel.textContent = "Role";
    const roleSelect = document.createElement("select");
    roleSelect.setAttribute("aria-label", "Muscle role");
    roleSelect.add(new Option("Primary", "primary"));
    roleSelect.add(new Option("Secondary", "secondary"));
    roleSelect.value = assignment.role;
    roleSelect.addEventListener("change", () => {
      assignment.role = roleSelect.value;
    });
    roleLabel.append(roleSelect);

    const loadFactorLabel = document.createElement("label");
    loadFactorLabel.textContent = "Load factor";
    const loadFactorInput = document.createElement("input");
    loadFactorInput.type = "number";
    loadFactorInput.min = "0.1";
    loadFactorInput.max = "2";
    loadFactorInput.step = "0.1";
    loadFactorInput.value = String(assignment.loadFactor ?? 1);
    loadFactorInput.setAttribute(
      "aria-label",
      "Muscle load factor from 0.1 to 2.0",
    );
    loadFactorInput.addEventListener("input", () => {
      assignment.loadFactor = Number(loadFactorInput.value);
    });
    loadFactorLabel.append(loadFactorInput);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-muscle-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", "Remove muscle group");
    removeButton.disabled = assignments.length <= 1;
    removeButton.addEventListener("click", () => {
      assignments.splice(assignments.indexOf(assignment), 1);
      renderRows();
    });

    row.append(muscleLabel, roleLabel, loadFactorLabel, removeButton);
    return row;
  }

  function renderExercise(exercise) {
    const card = document.createElement("article");
    card.className = "custom-workout-card";

    const heading = document.createElement("div");
    heading.className = "custom-exercise-header";
    const title = document.createElement("h3");
    title.textContent = exercise.name;
    const deleteButton = document.createElement("button");
    deleteButton.className = "button button-secondary";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete workout";
    deleteButton.addEventListener("click", async () => {
      if (
        !window.confirm(`Delete ${exercise.name} from your custom workouts?`)
      ) {
        return;
      }
      deleteButton.disabled = true;
      try {
        await window.MuscleRecoveryApi.deleteCustomExercise(exercise.id);
        card.remove();
        if (!workoutList.children.length) {
          setStatus(
            "No custom workouts yet. Create one while logging a workout.",
          );
        }
      } catch (error) {
        exerciseStatus.textContent =
          error.message || "Unable to delete custom workout.";
        exerciseStatus.className = "form-status error";
        deleteButton.disabled = false;
      }
    });
    heading.append(title, deleteButton);

    const form = document.createElement("form");
    form.className = "custom-workout-editor";
    const rows = document.createElement("div");
    rows.className = "custom-muscle-rows";
    const actions = document.createElement("div");
    actions.className = "custom-exercise-actions custom-workout-actions";
    const addPrimary = document.createElement("button");
    addPrimary.className = "text-button";
    addPrimary.type = "button";
    addPrimary.textContent = "+ Add primary muscle";
    const addSecondary = document.createElement("button");
    addSecondary.className = "text-button";
    addSecondary.type = "button";
    addSecondary.textContent = "+ Add secondary muscle";
    const save = document.createElement("button");
    save.className = "button";
    save.type = "submit";
    save.textContent = "Save changes";
    const exerciseStatus = document.createElement("p");
    exerciseStatus.className = "form-status";
    exerciseStatus.setAttribute("role", "status");

    let assignments = exercise.muscles.map((muscle) => ({
      muscleGroupId:
        muscleGroups.find((group) => group.slug === muscle.slug)?.id ?? "",
      role: muscle.role,
      loadFactor: muscle.loadFactor ?? 1,
    }));
    const renderRows = () => {
      rows.replaceChildren(
        ...assignments.map((assignment) =>
          createAssignmentRow(assignment, assignments, renderRows),
        ),
      );
    };
    addPrimary.addEventListener("click", () => {
      assignments.push({ muscleGroupId: "", role: "primary", loadFactor: 1 });
      renderRows();
    });
    addSecondary.addEventListener("click", () => {
      assignments.push({ muscleGroupId: "", role: "secondary", loadFactor: 1 });
      renderRows();
    });
    renderRows();

    form.addEventListener("input", () => {
      exerciseStatus.textContent = "";
      exerciseStatus.className = "form-status";
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const muscles = assignments.map((assignment) => ({
        muscleGroupId: Number(assignment.muscleGroupId),
        role: assignment.role,
        loadFactor: Number(assignment.loadFactor),
      }));
      if (muscles.some((muscle) => !muscle.muscleGroupId)) {
        exerciseStatus.textContent = "Choose a muscle group for every row.";
        exerciseStatus.className = "form-status error";
        return;
      }
      if (!muscles.some((muscle) => muscle.role === "primary")) {
        exerciseStatus.textContent =
          "Choose at least one primary muscle target.";
        exerciseStatus.className = "form-status error";
        return;
      }
      if (
        muscles.some(
          (muscle) =>
            !Number.isFinite(muscle.loadFactor) ||
            muscle.loadFactor < 0.1 ||
            muscle.loadFactor > 2,
        )
      ) {
        exerciseStatus.textContent =
          "Enter a load factor from 0.1 to 2.0 for every muscle.";
        exerciseStatus.className = "form-status error";
        return;
      }
      if (
        new Set(muscles.map((muscle) => muscle.muscleGroupId)).size !==
        muscles.length
      ) {
        exerciseStatus.textContent =
          "Each muscle group can only be assigned once.";
        exerciseStatus.className = "form-status error";
        return;
      }

      const controls = form.querySelectorAll("button, select, input");
      controls.forEach((control) => {
        control.disabled = true;
      });
      exerciseStatus.textContent = "Saving changes...";
      exerciseStatus.className = "form-status";
      try {
        const updated = await window.MuscleRecoveryApi.updateCustomExercise(
          exercise.id,
          muscles,
        );
        exercise.muscles = updated.muscles;
        assignments = updated.muscles.map((muscle) => ({
          muscleGroupId:
            muscleGroups.find((group) => group.slug === muscle.slug)?.id ?? "",
          role: muscle.role,
          loadFactor: muscle.loadFactor ?? 1,
        }));
        renderRows();
        exerciseStatus.textContent = "Muscle groups saved.";
        exerciseStatus.className = "form-status success";
      } catch (error) {
        exerciseStatus.textContent =
          error.message || "Unable to save muscle groups.";
        exerciseStatus.className = "form-status error";
      } finally {
        controls.forEach((control) => {
          control.disabled = false;
        });
        form.querySelectorAll(".remove-muscle-button").forEach((button) => {
          button.disabled = assignments.length <= 1;
        });
      }
    });

    actions.append(addPrimary, addSecondary, save);
    form.append(rows, actions, exerciseStatus);
    card.append(heading, form);
    return card;
  }

  async function loadCustomWorkouts() {
    try {
      const [exercises, groups] = await Promise.all([
        window.MuscleRecoveryApi.getCustomExercises(),
        window.MuscleRecoveryApi.getMuscleGroups(),
      ]);
      muscleGroups = groups;
      if (!exercises.length) {
        setStatus(
          "No custom workouts yet. Create one while logging a workout.",
        );
        return;
      }
      setStatus("");
      workoutList.replaceChildren(...exercises.map(renderExercise));
    } catch (error) {
      setStatus(error.message || "Unable to load custom workouts.", "error");
    }
  }

  loadCustomWorkouts();
})();

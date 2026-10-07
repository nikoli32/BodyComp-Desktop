(() => {
  const form = document.querySelector("#measurementForm");
  const dateInput = document.querySelector("#recordedDate");
  const weightInput = document.querySelector("#weightInput");
  const bodyFatInput = document.querySelector("#bodyFatInput");
  const unitInput = document.querySelector("#weightUnit");
  const historyUnitInput = document.querySelector("#historyWeightUnit");
  const preview = document.querySelector("#leanMassPreview");
  const status = document.querySelector("#measurementStatus");
  const list = document.querySelector("#measurementList");
  const heading = document.querySelector("#measurementHeading");
  const submitButton = document.querySelector("#measurementSubmit");
  const cancelEditButton = document.querySelector("#cancelMeasurementEdit");
  const { leanMassKg, weightFromKg, weightToKg } = window.MuscleMapUtils;
  const unitStorageKey = "bodycomp-weight-unit";
  let measurements = [];
  let editingId = null;
  let currentUnit = localStorage.getItem(unitStorageKey) || "lb";

  function localDateValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function selectedUnit() {
    return currentUnit;
  }

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = `form-status${type ? ` ${type}` : ""}`;
  }

  function updatePreview() {
    const weight = Number(weightInput.value);
    const bodyFatPercent = Number(bodyFatInput.value);
    if (
      !weightInput.value ||
      !bodyFatInput.value ||
      !Number.isFinite(weight) ||
      !Number.isFinite(bodyFatPercent)
    ) {
      preview.textContent = "Enter weight and body fat to calculate lean mass.";
      return;
    }
    const leanKg = leanMassKg(
      weightToKg(weight, selectedUnit()),
      bodyFatPercent,
    );
    preview.textContent = `Calculated lean mass: ${weightFromKg(leanKg, selectedUnit()).toFixed(2)} ${selectedUnit()}`;
  }

  function renderMeasurements() {
    list.replaceChildren();
    if (!measurements.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No body composition measurements yet.";
      list.append(empty);
      return;
    }

    for (const measurement of measurements) {
      const row = document.createElement("article");
      row.className = "measurement-row";
      const details = document.createElement("div");
      details.className = "measurement-row-details";
      const date = document.createElement("h3");
      date.textContent = new Date(measurement.recordedAt).toLocaleDateString(
        undefined,
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        },
      );
      const values = document.createElement("p");
      values.textContent = `${weightFromKg(measurement.weightKg, selectedUnit()).toFixed(2)} ${selectedUnit()} weight · ${Number(measurement.bodyFatPercent).toFixed(1)}% body fat · ${weightFromKg(measurement.leanMassKg, selectedUnit()).toFixed(2)} ${selectedUnit()} lean mass`;
      details.append(date, values);

      const actions = document.createElement("div");
      actions.className = "measurement-row-actions";
      const editButton = document.createElement("button");
      editButton.className = "text-button";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => editMeasurement(measurement));
      const deleteButton = document.createElement("button");
      deleteButton.className = "text-button danger-text";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () =>
        deleteMeasurement(measurement),
      );
      actions.append(editButton, deleteButton);
      row.append(details, actions);
      list.append(row);
    }
  }

  async function loadMeasurements() {
    try {
      measurements = await window.MuscleRecoveryApi.getBodyweightMeasurements();
      renderMeasurements();
    } catch (error) {
      setStatus(error.message || "Unable to load measurements.", "error");
      list.innerHTML = "";
    }
  }

  function editMeasurement(measurement) {
    editingId = measurement.id;
    heading.textContent = "Edit measurement";
    submitButton.textContent = "Save changes";
    cancelEditButton.hidden = false;
    dateInput.value = localDateValue(new Date(measurement.recordedAt));
    weightInput.value = weightFromKg(
      measurement.weightKg,
      selectedUnit(),
    ).toFixed(2);
    bodyFatInput.value = Number(measurement.bodyFatPercent).toFixed(1);
    setStatus("");
    updatePreview();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    editingId = null;
    form.reset();
    dateInput.value = localDateValue();
    unitInput.value = currentUnit;
    heading.textContent = "Add measurement";
    submitButton.textContent = "Save measurement";
    cancelEditButton.hidden = true;
    updatePreview();
  }

  async function deleteMeasurement(measurement) {
    if (!window.confirm("Delete this measurement?")) return;
    try {
      await window.MuscleRecoveryApi.deleteBodyweightMeasurement(
        measurement.id,
      );
      if (editingId === measurement.id) resetForm();
      setStatus("Measurement deleted.", "success");
      await loadMeasurements();
    } catch (error) {
      setStatus(error.message || "Unable to delete measurement.", "error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      recordedAt: new Date(`${dateInput.value}T12:00:00`).toISOString(),
      weightKg: weightToKg(Number(weightInput.value), selectedUnit()),
      bodyFatPercent: Number(bodyFatInput.value),
    };
    try {
      if (editingId) {
        await window.MuscleRecoveryApi.updateBodyweightMeasurement(
          editingId,
          payload,
        );
        setStatus("Measurement updated.", "success");
      } else {
        await window.MuscleRecoveryApi.createBodyweightMeasurement(payload);
        setStatus("Measurement saved.", "success");
      }
      resetForm();
      await loadMeasurements();
    } catch (error) {
      setStatus(error.message || "Unable to save measurement.", "error");
    }
  });

  function changeUnit(nextUnit) {
    const oldUnit = selectedUnit();
    const currentWeight = Number(weightInput.value);
    const hasWeight =
      Boolean(weightInput.value) && Number.isFinite(currentWeight);
    if (hasWeight) {
      weightInput.value = weightFromKg(
        weightToKg(currentWeight, oldUnit),
        nextUnit,
      ).toFixed(2);
    }
    currentUnit = nextUnit;
    unitInput.value = nextUnit;
    historyUnitInput.value = nextUnit;
    localStorage.setItem(unitStorageKey, nextUnit);
    renderMeasurements();
    updatePreview();
  }

  unitInput.addEventListener("change", () => changeUnit(unitInput.value));
  historyUnitInput.addEventListener("change", () =>
    changeUnit(historyUnitInput.value),
  );
  weightInput.addEventListener("input", updatePreview);
  bodyFatInput.addEventListener("input", updatePreview);
  cancelEditButton.addEventListener("click", resetForm);

  unitInput.value = currentUnit;
  historyUnitInput.value = unitInput.value;
  dateInput.value = localDateValue();
  updatePreview();
  loadMeasurements();
})();

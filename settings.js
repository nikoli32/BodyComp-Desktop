(() => {
  const passphrase = document.querySelector("#backupPassphrase");
  const confirmation = document.querySelector("#backupPassphraseConfirm");
  const status = document.querySelector("#backupStatus");
  const exportButton = document.querySelector("#exportBackup");
  const restoreButton = document.querySelector("#restoreBackup");

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = `form-status${kind ? ` ${kind}` : ""}`;
  }

  function setBusy(busy) {
    exportButton.disabled = busy;
    restoreButton.disabled = busy;
  }

  exportButton.addEventListener("click", async () => {
    if (!passphrase.reportValidity()) return;
    if (passphrase.value !== confirmation.value) {
      confirmation.setCustomValidity("Passphrases do not match.");
      confirmation.reportValidity();
      confirmation.setCustomValidity("");
      return;
    }
    setBusy(true);
    setStatus("Creating encrypted snapshot...");
    try {
      const result = await window.MuscleRecoveryApi.exportBackup({ passphrase: passphrase.value });
      setStatus(result.canceled ? "Backup export canceled." : `Encrypted backup saved to ${result.filePath}.`, result.canceled ? "" : "success");
    } catch (error) {
      setStatus(error.message || "Unable to export backup.", "error");
    } finally {
      passphrase.value = "";
      confirmation.value = "";
      setBusy(false);
    }
  });

  restoreButton.addEventListener("click", async () => {
    if (!passphrase.reportValidity()) return;
    setBusy(true);
    setStatus("Validating backup...");
    try {
      const result = await window.MuscleRecoveryApi.restoreBackup({ passphrase: passphrase.value });
      if (result.restored) {
        setStatus("Data restored. Sign in to a restored profile.", "success");
        window.setTimeout(() => window.location.assign("auth.html"), 800);
      } else {
        setStatus("Restore canceled.");
      }
    } catch (error) {
      setStatus(error.message || "Unable to restore backup.", "error");
    } finally {
      passphrase.value = "";
      confirmation.value = "";
      setBusy(false);
    }
  });
})();
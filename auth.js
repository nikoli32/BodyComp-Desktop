(() => {
  const form = document.querySelector("#authForm");
  const title = document.querySelector("#authTitle");
  const modeButton = document.querySelector("#authMode");
  const submit = document.querySelector("#authSubmit");
  const displayNameField = document.querySelector("#displayNameField");
  const displayName = document.querySelector("#displayName");
  const email = document.querySelector("#email");
  const password = document.querySelector("#password");
  const passwordHint = document.querySelector("#passwordHint");
  const status = document.querySelector("#authStatus");
  let registering = false;

  function renderMode() {
    title.textContent = registering ? "Create account" : "Sign in";
    submit.textContent = registering ? "Create account" : "Sign in";
    modeButton.textContent = registering
      ? "Already have an account? Sign in"
      : "Need an account? Create one";
    displayNameField.hidden = !registering;
    displayName.required = registering;
    passwordHint.hidden = !registering;
    password.autocomplete = registering ? "new-password" : "current-password";
    status.textContent = "";
  }

  modeButton.addEventListener("click", () => {
    registering = !registering;
    renderMode();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    status.className = "form-status";
    status.textContent = registering ? "Creating your account…" : "Signing in…";
    try {
      if (registering)
        await window.MuscleRecoveryApi.register({
          email: email.value,
          password: password.value,
          displayName: displayName.value.trim(),
        });
      else
        await window.MuscleRecoveryApi.login({
          email: email.value,
          password: password.value,
        });
      window.location.assign("index.html");
    } catch (error) {
      submit.disabled = false;
      status.className = "form-status error";
      status.textContent = error.message || "Unable to continue.";
    }
  });

  window.MuscleRecoveryApi.getCurrentUser()
    .then((user) => {
      if (user) window.location.assign("index.html");
    })
    .catch(() => {});
})();

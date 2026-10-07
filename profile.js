(function () {
  const avatarImg = document.getElementById("profilePicture");
  const avatarInput = document.getElementById("avatarInput");
  const changeAvatarBtn = document.getElementById("changeAvatarBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const tabs = document.querySelectorAll(".profile-tab");
  const panels = document.querySelectorAll(".profile-panel");
  const personalPanel = document.getElementById("personalPanel");
  const passwordPanel = document.getElementById("passwordPanel");
  const profileForm = document.getElementById("profileForm");
  const passwordForm = document.getElementById("passwordForm");
  const displayNameInput = document.getElementById("displayName");
  const emailInput = document.getElementById("email");
  const joinDateEl = document.getElementById("joinDate");
  const userIdEl = document.getElementById("userId");

  // --- Load user profile ---
  async function loadProfile() {
    try {
      const user = await window.MuscleRecoveryApi.getCurrentUser();
      if (!user) return;

      emailInput.value = user.email || "";
      displayNameInput.value = user.displayName || "";
      joinDateEl.textContent = new Date(user.createdAt).toLocaleDateString(
        "en-US",
        {
          year: "long",
          month: "long",
          date: "numeric",
        },
      );
      userIdEl.textContent = user.id;
      avatarImg.src = user.avatarUrl || "";
    } catch (err) {
      console.error(err);
    }
  }

  // --- Tabs ---
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      if (target === "personal") personalPanel.classList.add("active");
      if (target === "password") passwordPanel.classList.add("active");
    });
  });

  // --- Avatar change ---
  changeAvatarBtn.addEventListener("click", () => {
    if (window.MuscleRecoveryApi.isLoggedIn()) {
      avatarInput.click();
    } else {
      window.location.assign("auth.html");
    }
  });

  avatarInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      await window.MuscleRecoveryApi.updateAvatar(formData);
      avatarImg.src = URL.createObjectURL(file);
    } catch (err) {
      alert(err.message || "Failed to update avatar.");
    }
  });

  // --- Logout ---
  logoutBtn.addEventListener("click", async () => {
    if (window.MuscleRecoveryApi.isLoggedIn()) {
      await window.MuscleRecoveryApi.logout();
    }
    window.location.assign("auth.html");
  });

  // --- Save profile ---
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      displayName: displayNameInput.value.trim(),
    };
    try {
      await window.MuscleRecoveryApi.updateProfile(payload);
      displayNameInput.value = payload.displayName;
      alert("Profile saved successfully.");
    } catch (err) {
      alert(err.message || "Failed to save profile.");
    }
  });

  // --- Password change ---
  passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (newPassword !== confirmPassword) {
      alert("New passwords do not match.");
      return;
    }

    const payload = {
      currentPassword: currentPassword,
      newPassword: newPassword,
    };

    try {
      await window.MuscleRecoveryApi.changePassword(payload);
      alert("Password changed successfully.");
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";
    } catch (err) {
      alert(err.message || "Failed to change password.");
    }
  });

  // --- Initialize ---
  if (window.MuscleRecoveryApi.isLoggedIn()) {
    loadProfile();
  } else {
    window.location.assign("auth.html");
  }
})();

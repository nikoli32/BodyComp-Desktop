(() => {
  const titlebar = document.querySelector(".titlebar");
  if (!titlebar) return;

  if (!document.querySelector("#profileSection")) {
    titlebar.insertAdjacentHTML(
      "beforeend",
      `<div class="auth-section">
        <a id="signInButton" href="auth.html" class="text-button">Sign in</a>
        <div id="profileSection" class="profile-section" hidden>
          <button id="profileMenuButton" class="profile-button" type="button" aria-label="User profile menu" aria-expanded="false" aria-haspopup="true">
            <span class="profile-avatar" id="profileAvatar"></span>
          </button>
          <div id="profileDropdown" class="profile-dropdown" hidden role="menu">
            <div class="profile-info">
              <p id="profileName" class="profile-name"></p>
              <p id="profileEmail" class="profile-email"></p>
            </div>
            <hr class="profile-divider" />
            <button id="profileLink" class="profile-menu-item" type="button" role="menuitem">View Profile</button>
            <button id="settingsButton" class="profile-menu-item" type="button" role="menuitem">Settings</button>
            <button id="logoutButton" class="profile-menu-item" type="button" role="menuitem">Logout</button>
          </div>
        </div>
      </div>`,
    );
  }

  const signInButton = document.querySelector("#signInButton");
  const profileSection = document.querySelector("#profileSection");
  const profileMenuButton = document.querySelector("#profileMenuButton");
  const profileDropdown = document.querySelector("#profileDropdown");
  const profileAvatar = document.querySelector("#profileAvatar");
  const profileName = document.querySelector("#profileName");
  const profileEmail = document.querySelector("#profileEmail");
  const profileLink = document.querySelector("#profileLink");
  const settingsButton = document.querySelector("#settingsButton");
  const logoutButton = document.querySelector("#logoutButton");

  function closeMenu() {
    profileDropdown.hidden = true;
    profileMenuButton.setAttribute("aria-expanded", "false");
  }

  async function initializeAuthUI() {
    try {
      const user = await window.MuscleRecoveryApi.getCurrentUser();
      signInButton.hidden = true;
      profileSection.hidden = false;
      const displayName = user.displayName || user.name || user.email || "User";
      profileAvatar.textContent = displayName
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
        .slice(0, 2);
      profileName.textContent = displayName;
      profileEmail.textContent = user.email || "";
    } catch {
      signInButton.hidden = false;
      profileSection.hidden = true;
    }
  }

  profileMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    profileDropdown.hidden = !profileDropdown.hidden;
    profileMenuButton.setAttribute(
      "aria-expanded",
      String(!profileDropdown.hidden),
    );
  });

  document.addEventListener("click", (event) => {
    if (!profileSection.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !profileDropdown.hidden) {
      closeMenu();
      profileMenuButton.focus();
    }
  });

  profileDropdown.addEventListener("click", (event) => {
    if (event.target.closest("[role='menuitem']")) closeMenu();
  });

  profileLink.addEventListener("click", () => {
    window.location.assign("profile.html");
  });

  settingsButton.addEventListener("click", () => {
    window.location.assign("settings.html");
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await window.MuscleRecoveryApi.logout();
      window.location.assign("index.html");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Failed to logout. Please try again.");
    }
  });

  initializeAuthUI();
})();

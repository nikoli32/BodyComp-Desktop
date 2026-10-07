const packageInfo = require("./package.json");

const publisher = process.env.MSIX_PUBLISHER || "CN=BodyComp Development";
const identityName = process.env.MSIX_IDENTITY_NAME || "BodyCompDesktopDev";
const packageVersion =
  process.env.MSIX_PACKAGE_VERSION || `${packageInfo.version}.0`;
const certificateFile = process.env.MSIX_CERTIFICATE_FILE;
const certificatePassword = process.env.MSIX_CERTIFICATE_PASSWORD;

if (!/^\d+\.\d+\.\d+\.\d+$/.test(packageVersion)) {
  throw new Error("MSIX_PACKAGE_VERSION must be a four-part numeric version.");
}

const msixConfig = {
  ...(process.env.MSIX_WINDOWS_KIT_VERSION
    ? { windowsKitVersion: process.env.MSIX_WINDOWS_KIT_VERSION }
    : {}),
  ...(process.env.MSIX_WINDOWS_KIT_PATH
    ? { windowsKitPath: process.env.MSIX_WINDOWS_KIT_PATH }
    : {}),
  manifestVariables: {
    packageIdentity: identityName,
    publisher,
    publisherDisplayName:
      process.env.MSIX_PUBLISHER_DISPLAY_NAME || "Kyle Bailey",
    packageVersion,
    packageDisplayName: "BodyComp Desktop",
    appDisplayName: "BodyComp Desktop",
    packageDescription: packageInfo.description,
    packageMinOSVersion: "10.0.19041.0",
  },
};

if (certificateFile) {
  msixConfig.windowsSignOptions = {
    certificateFile,
    certificatePassword,
  };
}

module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: "com.bodycomp.desktop",
  },
  makers: [
    {
      name: "@electron-forge/maker-msix",
      platforms: ["win32"],
      config: msixConfig,
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["win32"],
    },
  ],
};

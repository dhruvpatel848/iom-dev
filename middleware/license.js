const { machineId } = require("node-machine-id");
const { License } = require("../models");

let cachedMachineId = null;

async function getMachineId() {
  if (!cachedMachineId) {
    cachedMachineId = await machineId();
  }
  return cachedMachineId;
}

const checkLicense = async (req, res, next) => {
  // Skip license check for static files and the activation page itself
  if (
    req.path.startsWith("/setup") ||
    req.path.startsWith("/css") ||
    req.path.startsWith("/js") ||
    req.path.startsWith("/images")
  ) {
    return next();
  }

  try {
    const currentMachineId = await getMachineId();

    // Find any active license bound to this machine
    const license = await License.findOne({
      where: {
        machine_id: currentMachineId,
        is_active: true,
      },
    });

    if (!license) {
      // Check if there are NO licenses at all (first run)
      // Or if licenses exist but none match this machine
      return res.redirect("/setup/activate");
    }

    // License valid
    req.license = license;
    next();
  } catch (error) {
    console.error("License check failed:", error);
    return res
      .status(500)
      .send("License verification failed. Please contact support.");
  }
};

module.exports = { checkLicense, getMachineId };

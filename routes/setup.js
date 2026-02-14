const express = require("express");
const router = express.Router();
const { License } = require("../models");
const { getMachineId } = require("../middleware/license");
const { body, validationResult } = require("express-validator");

// Show activation page
router.get("/activate", async (req, res) => {
  try {
    const currentId = await getMachineId();
    // Check if already activated to avoid loop if accessed manually
    const license = await License.findOne({
      where: { machine_id: currentId, is_active: true },
    });

    if (license) {
      return res.redirect("/");
    }

    res.render("setup/activate", {
      title: "Product Activation",
      machineId: currentId,
      error: null,
      layout: false, // Use a standalone layout or no layout
    });
  } catch (error) {
    console.error("Activation page error:", error);
    res.status(500).send("Error loading activation page");
  }
});

// Process activation
router.post(
  "/activate",
  [
    body("license_key")
      .trim()
      .notEmpty()
      .withMessage("License key is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      const currentId = await getMachineId();

      if (!errors.isEmpty()) {
        return res.render("setup/activate", {
          title: "Product Activation",
          machineId: currentId,
          error: errors.array()[0].msg,
          layout: false,
        });
      }

      const { license_key } = req.body;

      // 1. Find the license key in DB
      const license = await License.findOne({ where: { key: license_key } });

      if (!license) {
        return res.render("setup/activate", {
          title: "Product Activation",
          machineId: currentId,
          error: "Invalid License Key",
          layout: false,
        });
      }

      // 2. Check if already active
      if (license.is_active) {
        // If active, check if it matches THIS machine (re-activation?)
        if (license.machine_id === currentId) {
          return res.redirect("/");
        } else {
          return res.render("setup/activate", {
            title: "Product Activation",
            machineId: currentId,
            error: "This license key is already in use on another device.",
            layout: false,
          });
        }
      }

      // 3. Activate: Bind to machine ID
      license.machine_id = currentId;
      license.is_active = true;
      license.activated_at = new Date();
      await license.save();

      res.redirect("/");
    } catch (error) {
      console.error("Activation error:", error);
      res.render("setup/activate", {
        title: "Product Activation",
        machineId: "Unknown",
        error: "Activation failed: " + error.message,
        layout: false,
      });
    }
  },
);

module.exports = router;

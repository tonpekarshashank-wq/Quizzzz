import { test } from "node:test";
import assert from "node:assert/strict";
import { maintenanceAuthorized } from "../src/lib/maintenance-auth";
test("maintenance authentication rejects absent and malformed UTF-8 credentials", () => {
  assert.equal(
    maintenanceAuthorized("Bearer test-secret", "test-secret"),
    true,
  );
  assert.equal(
    maintenanceAuthorized("Bearer test-secrex", "test-secret"),
    false,
  );
  assert.equal(
    maintenanceAuthorized("Bearer ééééééééééé", "test-secret"),
    false,
  );
  assert.equal(maintenanceAuthorized(null, "test-secret"), false);
  assert.equal(maintenanceAuthorized("Bearer undefined", undefined), false);
});

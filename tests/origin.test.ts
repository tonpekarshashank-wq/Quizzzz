import { test } from "node:test";
import assert from "node:assert/strict";
import { validateOrigin } from "../src/lib/origin";
const local = {
  host: "127.0.0.1:3218",
  requestUrl: "http://localhost:3218/api/v1/auth/register",
  configuredOrigin: "http://127.0.0.1:3000",
  deployed: false,
};
test("local signup permits serving port despite default APP_ORIGIN and Next host normalization", () => {
  for (const host of ["localhost:3218", "127.0.0.1:3218"]) {
    assert.equal(
      validateOrigin({ ...local, origin: `http://${host}` }),
      `http://${host}`,
    );
  }
});
test("local signup rejects missing, external and wrong-port origins", () => {
  for (const origin of [
    null,
    "null",
    "https://evil.example",
    "http://localhost:3219",
    "http://localhost:3218.evil.example",
  ]) {
    assert.throws(() => validateOrigin({ ...local, origin }), { status: 403 });
  }
});
test("deployed validation requires exact configured origin", () => {
  assert.equal(
    validateOrigin({
      ...local,
      deployed: true,
      configuredOrigin: "https://quiz.example",
      origin: "https://quiz.example",
    }),
    "https://quiz.example",
  );
  assert.throws(
    () =>
      validateOrigin({
        ...local,
        deployed: true,
        origin: "http://127.0.0.1:3218",
      }),
    { status: 403 },
  );
  assert.throws(
    () =>
      validateOrigin({
        ...local,
        deployed: true,
        configuredOrigin: undefined,
        origin: "https://quiz.example",
      }),
    { status: 503 },
  );
});

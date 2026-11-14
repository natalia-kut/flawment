import assert from "node:assert/strict";
import test from "node:test";
import { isManagerialTitle } from "../lib/people/job-titles";

test("managerial job titles are recognised from their name", () => {
  for (const name of ["Manager", "Project manager", "Team lead", "Tech Lead", "Head of Design", "Engineering director", "CTO", "Kierownik projektu", "Liderka zespołu"]) {
    assert.equal(isManagerialTitle(name), true, name);
  }
  for (const name of ["Developer", "QA engineer", "Designer", "Leadership coach assistant", "Business analyst"]) {
    assert.equal(isManagerialTitle(name), false, name);
  }
});

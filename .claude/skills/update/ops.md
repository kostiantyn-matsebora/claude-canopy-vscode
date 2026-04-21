# update — Local Ops

---

## APPLY_CHANGE << change

Apply a single detected framework change to the extension implementation.

* APPLY_CHANGE << change
  * Read `constants/sync-points.md` to find extension files for `change.type`
  * Read the canopy framework file identified in `change.framework_file`
  * FOR_EACH << file in change.extension_files
    * Read the extension source file
    * IF << change is already reflected in the file (e.g. primitive already in RESERVED_PRIMITIVES, category already in VALID_CATEGORIES)
      * BREAK
    * Apply the code change described in `change.description`
    * Verify: re-read the file and confirm the change is correctly applied

---

## WRITE_UNIT_TESTS >> tests_written

Write or update unit tests for all modified extension source files.

* WRITE_UNIT_TESTS >> tests_written
  * Identify all extension source files modified during APPLY_CHANGE steps; also include any files listed in `context.extension_changes_summary`; deduplicate the combined list
  * Read `src/test/` directory to find existing test files for those modules
  * FOR_EACH << modified_file in modified_files
    * Read the modified source file to understand changed functions and constants
    * IF << test file exists for this module
      * Read existing test file and add or update test cases for the changes
    * ELSE
      * Create a new test file following the project test conventions
  * Return `tests_written` list of test file paths created or updated

---

## RUN_TESTS_UNTIL_PASS

Run the test suite iteratively, fixing failures, until all tests pass.

* RUN_TESTS_UNTIL_PASS
  * Run `npm test`
  * IF << all tests pass
    * BREAK
  * Read test output and identify failing tests and root causes
  * Fix the failing source or test code
  * Loop back to run `npm test` again

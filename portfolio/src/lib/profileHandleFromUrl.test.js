import { describe, expect, it } from "vitest";
import { profileHandleFromUrl } from "./profileHandleFromUrl.js";

describe("profileHandleFromUrl", () => {
  it("returns last path segment for GitHub", () => {
    expect(profileHandleFromUrl("https://github.com/Rodney-Codes")).toBe(
      "Rodney-Codes",
    );
    expect(profileHandleFromUrl("https://github.com/Rodney-Codes/")).toBe(
      "Rodney-Codes",
    );
  });

  it("returns slug for LinkedIn and strips query", () => {
    expect(
      profileHandleFromUrl(
        "https://www.linkedin.com/in/rohit-raj-b50809104/?trk=foo",
      ),
    ).toBe("rohit-raj-b50809104");
  });

  it("returns empty for invalid or empty input", () => {
    expect(profileHandleFromUrl("")).toBe("");
    expect(profileHandleFromUrl(null)).toBe("");
  });
});

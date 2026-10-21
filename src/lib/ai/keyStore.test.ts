import { afterEach, describe, expect, it } from "vitest";
import { clearConnection, connectionSnapshot, loadConnection, saveConnection } from "./keyStore";

const conn = { provider: "gemini" as const, key: "test-key-not-real", model: "gemini-2.5-flash" };

describe("the key in the browser", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("stays in sessionStorage by default (gone with the tab), and in localStorage only when remembered", () => {
    saveConnection(conn, false);
    expect(window.sessionStorage.length).toBe(1);
    expect(window.localStorage.length).toBe(0);
    expect(loadConnection()).toEqual({ ...conn, remember: false });
    saveConnection(conn, true);
    expect(window.sessionStorage.length).toBe(0);
    expect(loadConnection()).toEqual({ ...conn, remember: true });
    expect(window.location.href).not.toContain(conn.key);
  });

  it("is deleted from both storages, and ignores anything malformed", () => {
    saveConnection(conn, true);
    clearConnection();
    expect(loadConnection()).toBeNull();
    expect(connectionSnapshot()).toBeNull();
    window.sessionStorage.setItem("va.ai.connection", '{"provider":"evil","key":"x","model":"y"}');
    expect(loadConnection()).toBeNull();
  });
});

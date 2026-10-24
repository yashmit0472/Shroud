import React from "react";
import { afterEach,vi } from "vitest";
import { cleanup } from "@testing-library/react";
Object.assign(globalThis,{React});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});

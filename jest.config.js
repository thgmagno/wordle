const nextJest = require("next/jest");

// next/jest wires up SWC (so TS/JSX just work) without needing ts-jest or
// a hand-rolled babel/webpack config.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node", // the current suite is pure logic, no DOM needed
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  // SWC rewrites the "@/*" alias in static `import` statements at compile
  // time, so those already work without this. But a string passed to
  // jest.mock("@/...") is just a runtime argument — nothing rewrites it —
  // so Jest's own resolver needs to know the alias too, or jest.mock on
  // an "@/..." path fails with "Cannot find module".
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

module.exports = createJestConfig(customJestConfig);

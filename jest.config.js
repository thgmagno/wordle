const nextJest = require("next/jest");

// next/jest wires up SWC (so TS/JSX just work) and reads the "@/*" path
// alias straight from tsconfig.json, without needing ts-jest or a
// hand-rolled babel/webpack config.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node", // the current suite is pure logic, no DOM needed
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
};

module.exports = createJestConfig(customJestConfig);

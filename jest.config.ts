export default {
  rootDir: "./",
  preset: "ts-jest/presets/default-esm",
  resolver: "ts-jest-resolver",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  testEnvironment: "node",
  verbose: true,
  maxConcurrency: 1,
  collectCoverage: true,

};

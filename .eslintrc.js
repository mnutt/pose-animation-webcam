module.exports = {
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2019
  },
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  env: {
    es6: true,
    browser: true
  },
  globals: {},
  rules: {
    "no-console": 0
  },
  overrides: [
    {
      files: ["*.config.js", "bin/**/*.js"],
      env: {
        node: true
      },
      parserOptions: {
        sourceType: "script"
      }
    },
    {
      files: ["*.test.js"],
      env: {
        jest: true
      }
    }
  ]
};

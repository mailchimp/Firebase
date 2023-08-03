module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2023,
  },
  extends: [
    "eslint:recommended",
    "airbnb-base",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    quotes: ["error", "double", { allowTemplateLiterals: true }],
  },
  overrides: [
    {
      files: ["tests/*.js", "tests/**/*.js"],
      env: {
        jest: true,
      },
    },
  ],
  globals: {},
};

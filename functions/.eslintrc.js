module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2023,
  },
  extends: ["eslint:recommended", "airbnb-base"],
  rules: {
    "implicit-arrow-linebreak": "off",
    "object-curly-newline": "off",
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    quotes: ["error", "double", { allowTemplateLiterals: true }],
    "import/no-unresolved": [
      "error",
      {
        ignore: ["^firebase-admin/.+"],
      },
    ],
    "operator-linebreak": "off",
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

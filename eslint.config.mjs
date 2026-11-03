import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships flat configs: no FlatCompat bridge needed.
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler rules that eslint-config-next 16 turned into errors. They flag patterns this code base
    // uses on purpose (reading localStorage after mount, one-shot Math.random in confetti, a module-level
    // pending counter): kept visible as warnings until each spot is reworked.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".claude/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;

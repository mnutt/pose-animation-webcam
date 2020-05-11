import svg from "rollup-plugin-svg";
import resolve from "@rollup/plugin-node-resolve";
import commonJS from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import image from "@rollup/plugin-image";

export default {
  input: "js/main.js",
  output: {
    file: "dist/main.js",
    format: "es",
  },
  plugins: [
    resolve({ browser: true }),
    commonJS(),
    json(),
    svg(),
    image({ dom: true, exclude: "**/*.svg" }),
  ],
};

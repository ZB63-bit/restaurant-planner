import plugin from "tailwindcss/plugin";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ea580c",
          dark: "#c2410c",
        },
      },
    },
  },
  plugins: [
    // pointer-fine:hover: — gates hover styles so they don't fire on touch devices
    plugin(({ addVariant }) => {
      addVariant("pointer-fine", "@media (hover: hover) and (pointer: fine)");
    }),
  ],
};

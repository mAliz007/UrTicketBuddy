/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        seat: {
          available: "#22c55e",
          held: "#eab308",
          sold: "#ef4444",
          disabled: "#9ca3af",
        },
      },
    },
  },
  plugins: [],
};

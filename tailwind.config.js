/** Configuración de Tailwind CSS 3 (colores institucionales y tipografía del tablero) */
module.exports = {
  content: ["./src/**/*.jsx"],
  theme: {
    extend: {
      colors: { guinda: "#9F2241", guindaDark: "#6B1C35", dorado: "#BC955C", fondo: "#F4F6F8" },
      fontFamily: { sans: ["Montserrat", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};

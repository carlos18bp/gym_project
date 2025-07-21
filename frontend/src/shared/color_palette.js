/**
 * Pastel Color Palette System
 * Each color has a light variant (for backgrounds) and a dark variant (for icons/borders)
 * Colors are indexed by id for easy storage and retrieval
 */

export const COLOR_PALETTE = [
  {
    id: 0,
    name: "Gris Suave",
    light: "#F5F5F5",
    dark: "#9E9E9E",
    hex: "#E0E0E0"
  },
  {
    id: 1,
    name: "Rosa Pastel",
    light: "#FCE4EC",
    dark: "#AD1457",
    hex: "#F8BBD9"
  },
  {
    id: 2,
    name: "Lavanda",
    light: "#F3E5F5",
    dark: "#7B1FA2",
    hex: "#E1BEE7"
  },
  {
    id: 3,
    name: "Azul Suave",
    light: "#E3F2FD",
    dark: "#1565C0",
    hex: "#BBDEFB"
  },
  {
    id: 4,
    name: "Verde Menta",
    light: "#E8F5E8",
    dark: "#2E7D32",
    hex: "#C8E6C9"
  },
  {
    id: 5,
    name: "Amarillo Pastel",
    light: "#FFF8E1",
    dark: "#F57F17",
    hex: "#FFF176"
  },
  {
    id: 6,
    name: "Durazno",
    light: "#FFF3E0",
    dark: "#E65100",
    hex: "#FFCC80"
  },
  {
    id: 7,
    name: "Coral",
    light: "#FFEBEE",
    dark: "#C62828",
    hex: "#FFCDD2"
  },
  {
    id: 8,
    name: "Turquesa",
    light: "#E0F2F1",
    dark: "#00695C",
    hex: "#B2DFDB"
  },
  {
    id: 9,
    name: "Violeta",
    light: "#EDE7F6",
    dark: "#4527A0",
    hex: "#D1C4E9"
  },
  {
    id: 10,
    name: "Salmón",
    light: "#FFF4E6",
    dark: "#BF360C",
    hex: "#FFAB91"
  },
  {
    id: 11,
    name: "Aqua",
    light: "#E1F5FE",
    dark: "#0277BD",
    hex: "#81D4FA"
  },
  {
    id: 12,
    name: "Lima",
    light: "#F1F8E9",
    dark: "#558B2F",
    hex: "#DCEDC8"
  },
  {
    id: 13,
    name: "Lila",
    light: "#F9FBE7",
    dark: "#9E9D24",
    hex: "#E6EE9C"
  },
  {
    id: 14,
    name: "Crema",
    light: "#FFFDE7",
    dark: "#F9A825",
    hex: "#FFF59D"
  },
  {
    id: 15,
    name: "Celeste",
    light: "#E8EAF6",
    dark: "#303F9F",
    hex: "#C5CAE9"
  }
];

/**
 * Get color by ID
 * @param {number} colorId - The color ID
 * @returns {Object} Color object with light, dark, and hex properties
 */
export function getColorById(colorId) {
  return COLOR_PALETTE.find(color => color.id === colorId) || COLOR_PALETTE[0];
}

/**
 * Get color styles for CSS
 * @param {number} colorId - The color ID
 * @returns {Object} CSS properties object
 */
export function getColorStyles(colorId) {
  const color = getColorById(colorId);
  return {
    backgroundColor: color.light,
    borderColor: color.dark,
    color: color.dark
  };
}

/**
 * Get Tailwind CSS classes for a color
 * @param {number} colorId - The color ID
 * @returns {Object} Tailwind classes object
 */
export function getColorClasses(colorId) {
  const color = getColorById(colorId);
  return {
    background: `bg-[${color.light}]`,
    border: `border-[${color.dark}]`,
    text: `text-[${color.dark}]`,
    hover: `hover:bg-[${color.hex}]`
  };
}

/**
 * Generate a random color ID
 * @returns {number} Random color ID
 */
export function getRandomColorId() {
  return Math.floor(Math.random() * COLOR_PALETTE.length);
}

/**
 * Get all available colors
 * @returns {Array} Array of all color objects
 */
export function getAllColors() {
  return COLOR_PALETTE;
} 
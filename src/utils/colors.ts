// Professional color palette for categories
const PALETTE = [
  '#1976d2', // Blue
  '#2e7d32', // Green
  '#ed6c02', // Orange
  '#9c27b0', // Purple
  '#d32f2f', // Red
  '#0288d1', // Light Blue
  '#7b1fa2', // Deep Purple
  '#388e3c', // Grass Green
  '#f57c00', // Deep Orange
  '#455a64', // Blue Grey
];

const OTHER_COLOR = '#9e9e9e'; // Grey for undefined categories

const colorCache: Record<string, string> = {};
let colorIndex = 0;

export const getCategoryColor = (categoryName: string | undefined): string => {
  if (!categoryName) return OTHER_COLOR;
  
  if (colorCache[categoryName]) {
    return colorCache[categoryName];
  }
  
  const color = PALETTE[colorIndex % PALETTE.length];
  colorCache[categoryName] = color;
  colorIndex++;
  
  return color;
};

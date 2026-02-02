/**
 * Lumen+ Design System
 * ====================
 * Cores e estilos baseados na identidade visual católica.
 */

export const colors = {
  // Primárias - Azul profundo (confiança, espiritualidade)
  primary: {
    50: '#e6f0ff',
    100: '#b3d4ff',
    200: '#80b8ff',
    300: '#4d9cff',
    400: '#1a80ff',
    500: '#0066e6',
    600: '#0052b3',
    700: '#003d80',
    800: '#1a365d', // Principal
    900: '#0d1b2e',
  },

  // Secundárias - Dourado (luz, divindade)
  secondary: {
    50: '#fff9e6',
    100: '#ffecb3',
    200: '#ffdf80',
    300: '#ffd24d',
    400: '#ffc61a',
    500: '#e6ac00',
    600: '#b38600',
    700: '#806000',
    800: '#4d3a00',
    900: '#1a1300',
  },

  // Neutras
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Feedback
  success: {
    light: '#86efac',
    main: '#22c55e',
    dark: '#15803d',
  },
  warning: {
    light: '#fde047',
    main: '#eab308',
    dark: '#a16207',
  },
  error: {
    light: '#fca5a5',
    main: '#ef4444',
    dark: '#b91c1c',
  },
  info: {
    light: '#93c5fd',
    main: '#3b82f6',
    dark: '#1d4ed8',
  },

  // Backgrounds
  background: {
    primary: '#ffffff',
    secondary: '#f5f5f5',
    tertiary: '#e5e5e5',
  },

  // Text
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#737373',
    inverse: '#ffffff',
  },

  // Específicos
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

const theme = {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadow,
};

export default theme;

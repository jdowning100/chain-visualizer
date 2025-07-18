import { SpaceTheme } from './SpaceTheme.js';
import { TronTheme } from './TronTheme.js';
import QuaiTheme from './QuaiTheme.js';

export { SpaceTheme, TronTheme, QuaiTheme };

// Theme factory function
export const createTheme = (themeName, scene) => {
  switch (themeName) {
    case 'space':
      return new SpaceTheme(scene);
    case 'tron':
      return new TronTheme(scene);
    case 'quai':
      const theme = new QuaiTheme(scene);
      theme.init();
      return theme;
    default:
      return null;
  }
};

// Theme configurations for UI
export const themeConfigs = {
  normal: {
    name: 'Normal',
    description: 'Clean blockchain visualization'
  },
  space: {
    name: 'Space',
    description: 'Cosmic environment with planets, stars, and galaxies'
  },
  tron: {
    name: 'Tron',
    description: 'Futuristic digital grid world with light cycles and data streams'
  },
  quai: {
    name: 'Quai',
    description: 'Glass-like blocks with glowing red effects and textured surfaces'
  },
};
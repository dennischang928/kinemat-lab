import { createTheme } from '@mui/material/styles';

export const appColors = {
  layout: {
    appBackground: '#f5f5f5',
    contentBackground: '#ffffff',
    subtleBackground: '#f0f0f0',
    paperBackground: '#f9f9f9',
    elevatedSurface: '#fffef8',
  },
  navigation: {
    sidebarBackground: '#1b1b1b',
    sidebarBorder: '#2a2a2a',
    sidebarItemActive: '#2f2f2f',
    sidebarItemHover: '#2a2a2a',
    sidebarItemSelectedBorder: '#444',
    sidebarIcon: '#d0d0d0',
    sidebarIconActive: '#61dafb',
  },
  brand: {
    primary: '#fe8c00',
    primaryHover: '#3a3f4a',
    primarySoft: '#4a505e',
    accent: '#1b1b1b',
  },
  neutral: {
    textPrimary: '#333333',
    textSecondary: '#666666',
    textMuted: '#999999',
    textLight: '#aaaaaa',
    border: '#dddddd',
    borderStrong: '#cccccc',
    borderSubtle: '#e0e0e0',
  },
  status: {
    success: '#4caf50',
    error: '#f44336',
    warning: '#ff9800',
    info: '#1976d2',
    successSoft: '#e8f5e9',
    errorSoft: '#ffebee',
  },
  visualization: {
    previewBackground: '#ffffff',
    viewerBackground: 'radial-gradient(circle, #f0f0f0 0%, #d0d0d0 100%)',
    panelHeader: '#f0f0f0',
    rowBase: '#000000',
    rowJoint1: '#d32f2f',
    rowJoint2: '#1976d2',
    rowJoint3: '#388e3c',
    rowAngle1: '#ffebee',
    rowAngle2: '#e3f2fd',
    rowAngle3: '#e8f5e9',
    rowLink1: '#fff3e0',
    rowLink2: '#f3e5f5',
    rowLink3: '#e0f2f1',
    processHeader: '#6a5d1a',
    processBorder: '#e0d9b7',
  },
  chart: {
    pathBlue: '#0055ff',
    pathRed: '#ff3300',
    pathMuted: '#999999',
    constant: '#bbbbbb',
  },
};

const theme = createTheme({
  palette: {
    primary: {
      main: appColors.brand.primary,
      light: appColors.brand.primaryHover,
      dark: appColors.brand.primary,
      contrastText: '#ffffff',
    },
    secondary: {
      main: appColors.brand.accent,
      contrastText: appColors.brand.primary,
    },
    background: {
      default: appColors.layout.appBackground,
      paper: appColors.layout.contentBackground,
    },
    text: {
      primary: appColors.neutral.textPrimary,
      secondary: appColors.neutral.textSecondary,
    },
    divider: appColors.neutral.border,
  },
  appColors,
});

export default theme;
import { Platform } from 'react-native';
import type { BallType } from './engine/ballConfig';

/**
 * "Sunlit tabletop": warm paper screens around a deep felt board.
 * The board stays felt-dark in both themes so ivory letter balls and brass fittings always read the same.
 */
export interface Theme {
  dark: boolean;
  bg: string;
  bgDeep: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  boardBg: string;
  boardDeep: string;
  feltInk: string;
  feltLine: string;
  launchBg: string;
  trayBg: string;
  peg: string;
  pegShade: string;
  pegInk: string;
  pegCollected: string;
  pegCollectedInk: string;
  pegNew: string;
  bumper: string;
  bumperShade: string;
  tile: string;
  tileEdge: string;
  tileBorder: string;
  tileSelected: string;
  tileSelectedInk: string;
  primary: string;
  primaryDeep: string;
  primaryInk: string;
  accent: string;
  danger: string;
  success: string;
  ball: Record<BallType, string>;
}

const FELT = {
  boardBg: '#22524B',
  boardDeep: '#0F2E2A',
  feltInk: '#F4ECDC',
  feltLine: '#8FB5A8',
  launchBg: '#2C635A',
  trayBg: '#0C2421',
  peg: '#FFF9EE',
  pegShade: '#D9CBB0',
  pegInk: '#1B2232',
  pegCollected: '#E7A93B',
  pegCollectedInk: '#1B2232',
  pegNew: '#FFD866',
  bumper: '#D4AE6A',
  bumperShade: '#7A5A26',
} as const;

export const LIGHT: Theme = {
  dark: false,
  bg: '#F7F0E3',
  bgDeep: '#EFE3CC',
  surface: '#FFFBF3',
  ink: '#1B2232',
  muted: '#6A6253',
  line: '#E0D3BC',
  ...FELT,
  tile: '#FFFDF8',
  tileEdge: '#D8C8AA',
  tileBorder: '#C9B898',
  tileSelected: '#1B2232',
  tileSelectedInk: '#FFF9EE',
  primary: '#C04A30',
  primaryDeep: '#8E3320',
  primaryInk: '#FFF9EE',
  accent: '#E7A93B',
  danger: '#B3261E',
  success: '#2E7D57',
  ball: { normal: '#E4573D', precision: '#2F6FE0', pass: '#8A5BD8' },
};

export const DARK: Theme = {
  dark: true,
  bg: '#141820',
  bgDeep: '#0D1016',
  surface: '#1E2430',
  ink: '#F4ECDC',
  muted: '#ABA392',
  line: '#2F3644',
  ...FELT,
  boardBg: '#1B443E',
  boardDeep: '#0A201D',
  tile: '#232A37',
  tileEdge: '#11151C',
  tileBorder: '#465064',
  tileSelected: '#F4ECDC',
  tileSelectedInk: '#141820',
  primary: '#EE7A5E',
  primaryDeep: '#A84A33',
  primaryInk: '#141820',
  accent: '#F0B44A',
  danger: '#F2B8B5',
  success: '#7CCB9E',
  ball: { normal: '#FF7A5C', precision: '#5B8BFF', pass: '#B08CF5' },
};

export function withHighContrast(t: Theme): Theme {
  return {
    ...t,
    muted: t.dark ? '#D0D3D8' : '#3A3D42',
    line: t.dark ? '#8A8D91' : '#5C6066',
    tileBorder: t.ink,
    feltLine: '#DDEDE6',
    pegCollected: '#F28C28',
    pegNew: '#7FC4FF',
  };
}

export const TITLE_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });
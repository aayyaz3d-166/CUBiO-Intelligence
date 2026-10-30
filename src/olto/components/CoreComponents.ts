/**
 * OLTO Frontend Subsystem — Battery-Included Core UI Component Library
 * ====================================================================
 * Implements the 12 canonical OLTO primitives: Container, Row, Column, Grid,
 * Text, Button, Input, Card, Modal, Image, Badge, LoadingSpinner + Spacer & Toast.
 */

import { OltoDOMRenderer, OltoDOMElement, OltoDOMTextNode } from '../runtime/OltoDOMRenderer';
import { Theme, Elevation } from './Theme';

export interface StyleProps {
  padding?: number;
  margin?: number | string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  radius?: number;
  color?: string;
  background?: string;
  width?: number | string;
  height?: number | string;
  maxWidth?: number | string;
}

// ──────────────── 1. Container ────────────────
export interface ContainerProps extends StyleProps {
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
}

export function Container(props: ContainerProps = {}, children: (OltoDOMElement | OltoDOMTextNode)[] = []): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('div');
  el.setAttribute('class', 'olto-container');

  const maxW = props.maxWidth !== undefined ? `${props.maxWidth}px` : '1200px';
  const pad = props.padding !== undefined ? `${props.padding}px` : '16px';
  const marginStr = props.align === 'center' || props.align === undefined ? '0 auto' : '0';

  el.setAttribute('style', `max-width: ${maxW}; padding: ${pad}; margin: ${marginStr}; box-sizing: border-box; width: 100%;`);

  for (const child of children) {
    el.appendChild(child);
  }
  return el;
}

// ──────────────── 2. Row (Flex Horizontal) ────────────────
export interface RowProps extends StyleProps {
  justify?: 'start' | 'end' | 'center' | 'between' | 'around';
  align?: 'start' | 'end' | 'center' | 'stretch';
  gap?: number;
  wrap?: boolean;
}

export function Row(props: RowProps = {}, children: (OltoDOMElement | OltoDOMTextNode)[] = []): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('div');
  el.setAttribute('class', 'olto-row');

  const justifyMap: Record<string, string> = {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    between: 'space-between',
    around: 'space-around',
  };

  const alignMap: Record<string, string> = {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    stretch: 'stretch',
  };

  const jVal = justifyMap[props.justify || 'start'] || 'flex-start';
  const aVal = alignMap[props.align || 'center'] || 'center';
  const gapVal = props.gap !== undefined ? `${props.gap}px` : '0px';
  const wrapVal = props.wrap ? 'wrap' : 'nowrap';
  const mb = props.marginBottom !== undefined ? `margin-bottom: ${props.marginBottom}px;` : '';

  el.setAttribute('style', `display: flex; flex-direction: row; justify-content: ${jVal}; align-items: ${aVal}; gap: ${gapVal}; flex-wrap: ${wrapVal}; ${mb}`);

  for (const child of children) {
    el.appendChild(child);
  }
  return el;
}

// ──────────────── 3. Column (Flex Vertical) ────────────────
export interface ColumnProps extends StyleProps {
  justify?: 'start' | 'end' | 'center' | 'between';
  align?: 'start' | 'end' | 'center' | 'stretch';
  gap?: number;
}

export function Column(props: ColumnProps = {}, children: (OltoDOMElement | OltoDOMTextNode)[] = []): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('div');
  el.setAttribute('class', 'olto-column');

  const gapVal = props.gap !== undefined ? `${props.gap}px` : '0px';
  const mb = props.marginBottom !== undefined ? `margin-bottom: ${props.marginBottom}px;` : '';

  el.setAttribute('style', `display: flex; flex-direction: column; gap: ${gapVal}; ${mb}`);

  for (const child of children) {
    el.appendChild(child);
  }
  return el;
}

// ──────────────── 4. Grid ────────────────
export interface GridProps extends StyleProps {
  columns?: number | number[];
  gap?: number;
  rowGap?: number;
}

export function Grid(props: GridProps = {}, children: (OltoDOMElement | OltoDOMTextNode)[] = []): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('div');
  el.setAttribute('class', 'olto-grid');

  let cols = 3;
  if (typeof props.columns === 'number') {
    cols = props.columns;
  } else if (Array.isArray(props.columns) && props.columns.length > 0) {
    cols = props.columns[props.columns.length - 1]; // desktop max columns
  }

  const gapVal = props.gap !== undefined ? `${props.gap}px` : '16px';
  el.setAttribute('style', `display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: ${gapVal}; width: 100%;`);

  for (const child of children) {
    el.appendChild(child);
  }
  return el;
}

// ──────────────── 5. Text ────────────────
export interface TextProps extends StyleProps {
  size?: number;
  weight?: number | string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxLines?: number;
}

export function Text(text: string | (() => any), props: TextProps = {}): OltoDOMElement {
  const isHeading = props.size && props.size >= 24;
  const tag = isHeading ? (props.size && props.size >= 32 ? 'h1' : 'h2') : 'p';
  const el = OltoDOMRenderer.createElement(tag);
  el.setAttribute('class', 'olto-text');

  const sizeVal = props.size !== undefined ? `${props.size}px` : '16px';
  const weightVal = props.weight !== undefined ? String(props.weight) : 'normal';
  const colorVal = props.color || Theme.colors.textPrimary;
  const alignVal = props.align || 'left';
  const mb = props.marginBottom !== undefined ? `margin-bottom: ${props.marginBottom}px;` : 'margin: 0;';
  const mt = props.marginTop !== undefined ? `margin-top: ${props.marginTop}px;` : '';

  el.setAttribute('style', `font-size: ${sizeVal}; font-weight: ${weightVal}; color: ${colorVal}; text-align: ${alignVal}; ${mb} ${mt}`);

  if (typeof text === 'function') {
    el.appendChild(OltoDOMRenderer.bindText(text));
  } else {
    el.appendChild(OltoDOMRenderer.createTextNode(text));
  }

  return el;
}

// ──────────────── 6. Button ────────────────
export interface ButtonProps {
  label: string | (() => string);
  variant?: 'solid' | 'outline' | 'ghost';
  disabled?: boolean | (() => boolean);
  active?: boolean | (() => boolean);
  icon?: string;
  color?: string;
  onClick?: () => void;
}

export function Button(props: ButtonProps): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('button');
  el.setAttribute('class', 'olto-button');

  const variant = props.variant || 'solid';
  const primaryColor = props.color || Theme.colors.primary;

  let baseStyle = 'padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 14px;';
  if (variant === 'solid') {
    baseStyle += ` background-color: ${primaryColor}; color: #ffffff; border: none;`;
  } else if (variant === 'outline') {
    baseStyle += ` background-color: transparent; color: ${primaryColor}; border: 1.5px solid ${primaryColor};`;
  } else if (variant === 'ghost') {
    baseStyle += ` background-color: transparent; color: ${primaryColor}; border: none;`;
  }

  el.setAttribute('style', baseStyle);

  if (typeof props.label === 'function') {
    el.appendChild(OltoDOMRenderer.bindText(props.label));
  } else {
    el.appendChild(OltoDOMRenderer.createTextNode(props.label));
  }

  if (props.onClick) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      props.onClick!();
    });
  }

  if (props.disabled) {
    if (typeof props.disabled === 'function') {
      OltoDOMRenderer.bindAttribute(el, 'disabled', props.disabled);
    } else {
      el.setAttribute('disabled', true);
    }
  }

  return el;
}

// ──────────────── 7. Input ────────────────
export interface InputProps {
  value?: string | (() => string);
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'number';
  error?: string | (() => string);
  onInput?: (val: string) => void;
}

export function Input(props: InputProps): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('input');
  el.setAttribute('class', 'olto-input');
  el.setAttribute('type', props.type || 'text');

  if (props.placeholder) {
    el.setAttribute('placeholder', props.placeholder);
  }

  const borderCol = props.error ? Theme.colors.error : Theme.colors.border;
  el.setAttribute('style', `padding: 10px 14px; border: 1.5px solid ${borderCol}; border-radius: 8px; font-size: 14px; width: 100%; box-sizing: border-box; background: ${Theme.colors.surface}; color: ${Theme.colors.textPrimary}; outline: none;`);

  if (props.value !== undefined) {
    if (typeof props.value === 'function') {
      OltoDOMRenderer.bindAttribute(el, 'value', props.value);
    } else {
      el.setAttribute('value', props.value);
    }
  }

  if (props.onInput) {
    el.addEventListener('input', (e) => {
      const val = e.data !== undefined ? String(e.data) : (el.getAttribute('value') as string) || '';
      props.onInput!(val);
    });
  }

  return el;
}

// ──────────────── 8. Card ────────────────
export interface CardProps extends StyleProps {
  elevation?: number;
}

export function Card(props: CardProps = {}, children: (OltoDOMElement | OltoDOMTextNode)[] = []): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('div');
  el.setAttribute('class', 'olto-card');

  const rad = props.radius !== undefined ? `${props.radius}px` : '12px';
  const pad = props.padding !== undefined ? `${props.padding}px` : '16px';
  const shadow = Elevation[props.elevation !== undefined ? (props.elevation as keyof typeof Elevation) : 1] || Elevation[1];
  const bg = props.background || Theme.colors.surface;
  const border = Theme.colors.border;

  el.setAttribute('style', `background: ${bg}; border-radius: ${rad}; padding: ${pad}; box-shadow: ${shadow}; border: 1px solid ${border}; box-sizing: border-box;`);

  for (const child of children) {
    el.appendChild(child);
  }
  return el;
}

// ──────────────── 9. Modal ────────────────
export interface ModalProps {
  isOpen: boolean | (() => boolean);
  title?: string;
  width?: number;
  onClose?: () => void;
}

export function Modal(props: ModalProps, children: (OltoDOMElement | OltoDOMTextNode)[] = []): OltoDOMElement {
  const overlay = OltoDOMRenderer.createElement('div');
  overlay.setAttribute('class', 'olto-modal-overlay');
  overlay.setAttribute('style', 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000;');

  const dialog = OltoDOMRenderer.createElement('div');
  dialog.setAttribute('class', 'olto-modal-dialog');
  const w = props.width ? `${props.width}px` : '500px';
  dialog.setAttribute('style', `background: ${Theme.colors.surface}; border-radius: 16px; padding: 24px; width: ${w}; max-width: 90%; box-shadow: ${Elevation[4]};`);

  if (props.title) {
    const titleRow = Row({ justify: 'between', align: 'center', marginBottom: 16 }, [
      Text(props.title, { size: 20, weight: 'bold' }),
      Button({
        label: '✕',
        variant: 'ghost',
        onClick: () => {
          if (props.onClose) props.onClose();
        },
      }),
    ]);
    dialog.appendChild(titleRow);
  }

  for (const child of children) {
    dialog.appendChild(child);
  }

  overlay.appendChild(dialog);

  if (typeof props.isOpen === 'function') {
    return OltoDOMRenderer.bindConditional(props.isOpen, () => overlay);
  }

  return props.isOpen ? overlay : OltoDOMRenderer.createElement('div');
}

// ──────────────── 10. Image ────────────────
export interface ImageProps {
  src: string;
  width?: number | string;
  height?: number | string;
  radius?: number;
  fit?: 'cover' | 'contain' | 'fill';
}

export function Image(props: ImageProps): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('img');
  el.setAttribute('class', 'olto-image');
  el.setAttribute('src', props.src);

  const w = props.width !== undefined ? (typeof props.width === 'number' ? `${props.width}px` : props.width) : '100%';
  const h = props.height !== undefined ? (typeof props.height === 'number' ? `${props.height}px` : props.height) : 'auto';
  const rad = props.radius !== undefined ? `${props.radius}px` : '0px';
  const fit = props.fit || 'cover';

  el.setAttribute('style', `width: ${w}; height: ${h}; border-radius: ${rad}; object-fit: ${fit}; display: block;`);
  return el;
}

// ──────────────── 11. Badge ────────────────
export interface BadgeProps {
  label: string | (() => string);
  color?: string;
  icon?: string;
}

export function Badge(props: BadgeProps): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('span');
  el.setAttribute('class', 'olto-badge');

  const bg = props.color || Theme.colors.primary;
  el.setAttribute('style', `display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${bg}22; color: ${bg}; border: 1px solid ${bg}44;`);

  if (typeof props.label === 'function') {
    el.appendChild(OltoDOMRenderer.bindText(props.label));
  } else {
    el.appendChild(OltoDOMRenderer.createTextNode(props.label));
  }

  return el;
}

// ──────────────── 12. LoadingSpinner ────────────────
export interface SpinnerProps {
  size?: number;
  message?: string;
  color?: string;
}

export function LoadingSpinner(props: SpinnerProps = {}): OltoDOMElement {
  const row = Row({ align: 'center', gap: 10 }, []);
  row.setAttribute('class', 'olto-spinner-container');

  const spinner = OltoDOMRenderer.createElement('div');
  const sizeVal = props.size !== undefined ? `${props.size}px` : '24px';
  const col = props.color || Theme.colors.primary;

  spinner.setAttribute('class', 'olto-spinner');
  spinner.setAttribute('style', `width: ${sizeVal}; height: ${sizeVal}; border: 3px solid ${col}33; border-top-color: ${col}; border-radius: 50%; animation: olto-spin 0.8s linear infinite;`);

  row.appendChild(spinner);

  if (props.message) {
    row.appendChild(Text(props.message, { size: 14, color: Theme.colors.textMuted }));
  }

  return row;
}

// ──────────────── 13. Spacer ────────────────
export function Spacer(size: number = 16): OltoDOMElement {
  const el = OltoDOMRenderer.createElement('div');
  el.setAttribute('class', 'olto-spacer');
  el.setAttribute('style', `height: ${size}px; width: ${size}px; flex-shrink: 0;`);
  return el;
}

// ──────────────── 14. Toast ────────────────
export interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export class ToastNotificationManager {
  private static activeToasts: { message: string; type: string }[] = [];

  public static show(message: string, options: ToastOptions = {}): void {
    const type = options.type || 'info';
    this.activeToasts.push({ message, type });
  }

  public static getActive(): { message: string; type: string }[] {
    return this.activeToasts;
  }

  public static clear(): void {
    this.activeToasts = [];
  }
}

export const Toast = ToastNotificationManager;

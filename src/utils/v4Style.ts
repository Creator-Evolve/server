export enum V4StyleColorEnum {
  Red = '0000FF',
  Green = '00FF00',
  Blue = 'FF0000',
  Yellow = '00FFFF',
  Magenta = 'FF00FF',
  Cyan = 'FFFF00',
  White = 'FFFFFF',
  Black = '000000',
  Transparent = '00000000',
}

export interface V4StyleProps {
  fontName?: string;
  fontSize?: number;
  primaryColor?: V4StyleColorEnum;
  secondaryColor?: V4StyleColorEnum;
  outlineColor?: V4StyleColorEnum;
  backColor?: V4StyleColorEnum;
  bgColor?: string; // New property for background color
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeOut?: boolean;
  scaleX?: number;
  scaleY?: number;
  spacing?: number;
  angle?: number;
  borderStyle?: number;
  outline?: number;
  shadow?: number;
  alignment?: number;
  marginL?: number;
  marginR?: number;
  marginV?: number;
  encoding?: number;
}

export function convertHexToV4StyleColor(hex: string): string {
  // Remove the '#' if it exists
  const cleanHex = hex.replace('#', '');
  // Convert from RRGGBB to BGR
  const bgr = cleanHex.slice(4) + cleanHex.slice(2, 4) + cleanHex.slice(0, 2);
  return bgr.toUpperCase();
}

export function generateV4Style(
  props: V4StyleProps,
  customFormat?: string[],
): string {
  // Default values
  const defaultProps: Required<V4StyleProps> = {
    fontName: 'Arial',
    fontSize: 20,
    primaryColor: V4StyleColorEnum.White,
    secondaryColor: V4StyleColorEnum.Yellow,
    outlineColor: V4StyleColorEnum.Black,
    backColor: V4StyleColorEnum.Transparent,
    bgColor: '', // Default value for bgColor
    bold: false,
    italic: false,
    underline: false,
    strikeOut: false,
    scaleX: 100,
    scaleY: 100,
    spacing: 0,
    angle: 0,
    borderStyle: 1,
    outline: 2,
    shadow: 0,
    alignment: 2,
    marginL: 10,
    marginR: 10,
    marginV: 10,
    encoding: 1,
  };

  // Merge default props with provided props
  const mergedProps = { ...defaultProps, ...props };

  // Default format
  const defaultFormat = [
    'Name',
    'Fontname',
    'Fontsize',
    'PrimaryColour',
    'SecondaryColour',
    'OutlineColour',
    'BackColour',
    'Bold',
    'Italic',
    'Underline',
    'StrikeOut',
    'ScaleX',
    'ScaleY',
    'Spacing',
    'Angle',
    'BorderStyle',
    'Outline',
    'Shadow',
    'Alignment',
    'MarginL',
    'MarginR',
    'MarginV',
    'Encoding',
  ];

  // Use custom format if provided, otherwise use default
  const format = customFormat || defaultFormat;

  // Convert color from enum to ASS format
  function convertColor(color: V4StyleColorEnum): string {
    return `&H${color}`;
  }

  // Build the style string based on the format
  const styleValues = format.map((prop) => {
    switch (prop) {
      case 'Name':
        return 'Default';
      case 'Fontname':
        return mergedProps.fontName;
      case 'Fontsize':
        return mergedProps.fontSize;
      case 'PrimaryColour':
        return convertColor(mergedProps.primaryColor);
      case 'SecondaryColour':
        return convertColor(mergedProps.secondaryColor);
      case 'OutlineColour':
        return convertColor(mergedProps.outlineColor);
      case 'BackColour':
        return convertColor(mergedProps.backColor);
      case 'Bold':
        return mergedProps.bold ? '-1' : '0';
      case 'Italic':
        return mergedProps.italic ? '-1' : '0';
      case 'Underline':
        return mergedProps.underline ? '-1' : '0';
      case 'StrikeOut':
        return mergedProps.strikeOut ? '-1' : '0';
      case 'ScaleX':
        return mergedProps.scaleX;
      case 'ScaleY':
        return mergedProps.scaleY;
      case 'Spacing':
        return mergedProps.spacing;
      case 'Angle':
        return mergedProps.angle;
      case 'BorderStyle':
        return mergedProps.borderStyle;
      case 'Outline':
        return mergedProps.outline;
      case 'Shadow':
        return mergedProps.shadow;
      case 'Alignment':
        return mergedProps.alignment;
      case 'MarginL':
        return mergedProps.marginL;
      case 'MarginR':
        return mergedProps.marginR;
      case 'MarginV':
        return mergedProps.marginV;
      case 'Encoding':
        return mergedProps.encoding;
      default:
        return '';
    }
  });

  const formatLine = `Format: ${format.join(', ')}`;
  const styleLine = `Style: ${styleValues.join(',')}`;

  return `${formatLine}\n${styleLine}`;
}

// Example usage
// const exampleStyle = generateV4Style({
//   primaryColor: Color.Red,
//   bold: true,
//   fontSize: 24,
// });

// Example with custom format
// const customFormatStyle = generateV4Style(
//   {
//     primaryColor: Color.Blue,
//     italic: true,
//   },
//   ['Name', 'PrimaryColour', 'Italic', 'Fontsize'],
// );


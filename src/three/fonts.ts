// Fonts are bundled locally (no runtime network calls). troika-three-text reads .woff.
import monoRegular from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?url';
import monoBold from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff?url';
import sansMedium from '@fontsource/inter/files/inter-latin-500-normal.woff?url';
import sansBold from '@fontsource/inter/files/inter-latin-700-normal.woff?url';

export const FONTS = { mono: monoRegular, monoBold, sans: sansMedium, sansBold } as const;

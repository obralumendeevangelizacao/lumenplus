import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

/** Tipo seguro para nomes de ícones do Ionicons. */
export type IoniconsName = ComponentProps<typeof Ionicons>['name'];

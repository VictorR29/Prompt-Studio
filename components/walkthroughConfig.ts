
import { AppView } from '../types';

export interface WalkthroughStep {
  targetSelector: string;
  title: string;
  content: string;
  view?: AppView;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  isRect?: boolean;
  clickOnNext?: boolean;
}

export const walkthroughSteps: WalkthroughStep[] = [
  {
    targetSelector: '[data-tour-id="nav-extractor"]',
    title: 'Bienvenido a Prompt Studio',
    content: 'Este es el Extractor. Úsalo para análisis rápidos y aislados de imágenes, para extraer características como el estilo, la pose o los colores.',
    view: 'extractor',
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour-id="nav-gallery"]',
    title: 'Galería Central',
    content: 'Todos tus prompts y fragmentos guardados viven aquí, listos para ser reutilizados en cualquier momento en el Editor.',
    view: 'gallery',
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour-id="nav-playground"]',
    title: 'Refinador IA',
    content: 'El lugar para perfeccionar tus prompts. Carga uno desde la galería o pega un texto y conversa con la IA para mejorarlo dinámicamente.',
    view: 'playground',
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour-id="nav-fusion"]',
    title: 'Laboratorio de Fusión 🧪',
    content: 'Experimenta con la "Alquimia Visual". Mezcla hasta 3 imágenes o conceptos de texto y deja que la IA sintetice un híbrido perfecto combinando su ADN visual.',
    view: 'fusion',
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour-id="nav-editor"]',
    title: 'El Editor Hub',
    content: 'Este es tu panel de control principal. Aquí es donde la magia ocurre. Vamos a explorar las diferentes formas de empezar.',
    view: 'editor',
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour-id="editor-generate-ai"]',
    title: 'Generar con IA',
    content: 'La forma más potente de empezar. Describe una idea, añade un estilo y/o una imagen de referencia, y la IA creará una base modular completa para que la edites.',
    view: 'editor',
    placement: 'top',
    isRect: true,
  },
  {
    targetSelector: '[data-tour-id="editor-paste-text"]',
    title: 'Analizar un Prompt Existente',
    content: 'Pega cualquier prompt de texto aquí. La IA lo analizará y lo descompondrá automáticamente en los 9 módulos para que puedas refinarlo.',
    view: 'editor',
    placement: 'left',
    isRect: true,
  },
  {
    targetSelector: '[data-tour-id="editor-import-json"]',
    title: 'Importar Plantillas JSON',
    content: 'Si tienes un prompt en formato JSON, puedes pegarlo aquí para guardarlo como una plantilla reutilizable en tu galería. Ideal para estructuras complejas.',
    view: 'editor',
    placement: 'right',
    isRect: true,
  },
  {
    targetSelector: '[data-tour-id="editor-save-external"]',
    title: 'Guardar Prompt Externo',
    content: '¿Tienes un prompt listo de otro sitio? Pégalo aquí para guardarlo directamente en tu galería con portada y metadatos generados por IA.',
    view: 'editor',
    placement: 'left',
    isRect: true,
  },
  {
    targetSelector: '[data-tour-id="editor-start-blank"]',
    title: 'Empezar en Blanco',
    content: 'Y por supuesto, puedes empezar desde cero. Vamos a entrar para ver todas las herramientas a tu disposición. Haz clic en "Siguiente".',
    view: 'editor',
    placement: 'top',
    isRect: true,
    clickOnNext: true,
  },
  {
    targetSelector: '[data-tour-id="editor-modules-grid"]',
    title: 'Los 9 Módulos Clave',
    content: "El editor está dividido en 9 módulos. Cada uno controla un aspecto específico de tu imagen final, como el 'Sujeto', la 'Pose' o el 'Estilo'.",
    view: 'editor',
    placement: 'center',
    isRect: true,
  },
  {
    targetSelector: '[data-tour-id="editor-module-subject"]',
    title: 'Edición Directa',
    content: 'Puedes escribir directamente en cualquier módulo para añadir o cambiar detalles. ¡Es así de simple!',
    view: 'editor',
    placement: 'right',
    isRect: true,
  },
  {
    targetSelector: '[data-tour-id="editor-module-subject"] [data-tour-id="module-image-upload"]',
    title: 'Extraer desde Imagen',
    content: 'También puedes subir una imagen directamente a un módulo. La IA la analizará y rellenará el campo de texto por ti. ¡Es la función del Extractor, pero dentro de tu flujo de trabajo!',
    view: 'editor',
    placement: 'right',
    isRect: true,
  },
  {
    targetSelector: '[data-tour-id="editor-module-subject"] [data-tour-id="module-actions-footer"]',
    title: 'Herramientas del Módulo',
    content: 'Cada módulo tiene herramientas poderosas: analiza desde una imagen, optimiza con IA (chispas), importa fragmentos desde tu galería (cuadrícula), o guarda el contenido actual (guardar).',
    view: 'editor',
    placement: 'right',
    isRect: true,
  },
  {
    targetSelector: '[data-tour-id="editor-output-section"]',
    title: 'Ensamblaje Final',
    content: 'Cuando estés listo, ven aquí para ensamblar todos tus módulos en un prompt final de texto o en una estructura JSON avanzada.',
    view: 'editor',
    placement: 'top',
    isRect: true,
  },
  {
    targetSelector: '[data-tour-id="main-title"]',
    title: '¡Todo Listo!',
    content: "Ahora conoces los fundamentos de Prompt Studio. Experimenta, combina y crea prompts increíbles. ¡El lienzo es tuyo!",
    view: 'editor',
    placement: 'bottom',
    isRect: true,
  }
];

# Prompt Studio 🎨: Ingeniería de Prompts de Nueva Generación

**Prompt Studio** es una suite avanzada para la **Ingeniería de Prompts** en la generación de imágenes con IA. Potenciada por **Google Gemini 2.5**, esta aplicación no solo organiza tus ideas, sino que actúa como un **Director Creativo**, expandiendo conceptos vagos en instrucciones técnicas precisas.

Esta aplicación web está construida con **React, Vite y Tailwind CSS**, utilizando la última tecnología multimodal de Google.

---

## 🌟 Novedad Principal: El Refinador IA (Playground)

El **Refinador IA** transforma la ingeniería de prompts en una conversación fluida. Ya no necesitas editar texto manualmente; simplemente chatea con la IA.

![Concepto del Refinador IA](assets/editor-nuevo.png)

*   **Rol de Experto:** La IA no transcribe; **interpreta**. Si pides *"hazlo estilo cartoon"*, el sistema generará automáticamente: *"vibrant cartoon style, cel shaded, bold outlines, 2D animation aesthetic"*.
*   **Edición en Tiempo Real:** Cada mensaje actualiza instantáneamente uno de los 9 módulos estructurales (Sujeto, Estilo, Pose, etc.).
*   **Ensamblaje Síncrono:** El prompt maestro se recalcula en tiempo real. Al pulsar "Copiar", obtienes el resultado final instantáneamente, sin esperas ni errores de permisos.
*   **Modo Móvil Optimizado:** Una interfaz de pestañas inteligente que separa el chat de la visualización del estado del prompt para una experiencia perfecta en pantallas pequeñas.

---

## 🚀 El Editor Modular

El corazón de la aplicación sigue siendo su capacidad para descomponer cualquier idea en **9 módulos editables**:

1.  **Sujeto** (Subject)
2.  **Pose** (Pose)
3.  **Expresión** (Expression)
4.  **Vestimenta** (Outfit)
5.  **Objeto** (Object)
6.  **Escena** (Scene)
7.  **Color** (Color)
8.  **Composición** (Composition)
9.  **Estilo** (Style)

### Flujos de Trabajo:
*   **Empezar en Blanco:** Construye desde cero módulo a módulo.
*   **Ingeniería Inversa (Extractor):** Sube imágenes a cualquier módulo y deja que la visión multimodal de Gemini extraiga la descripción técnica.
*   **Estructurador IA:** Describe una idea vaga (ej: "un astronauta perdido") y la IA generará una estructura JSON completa inicial.
*   **Importación de Texto/JSON:** Pega prompts existentes y el sistema los modularizará automáticamente.

---

## 🧠 Lógica Maestra de Ensamblaje

Prompt Studio utiliza un sistema jerárquico estricto para generar el prompt final:

1.  **Prioridad de Estilo:** El módulo de "Estilo" dicta la estética global, sobrescribiendo descripciones conflictivas en otros módulos.
2.  **Fusión Inteligente:** Si el módulo de "Color" define una paleta, esta se aplica semánticamente a la ropa y el entorno, en lugar de simplemente pegar las palabras clave al final.
3.  **Sin Conflictos:** El sistema limpia redundancias antes de generar la salida final para maximizar la calidad en modelos como Midjourney, Stable Diffusion o DALL-E 3.

---

## 💾 Gestión de Datos y Portabilidad

Dado que Prompt Studio funciona completamente en el navegador para maximizar la privacidad, hemos incluido herramientas profesionales de gestión de datos en el menú de **Configuración**:

*   **Exportar Galería:** Genera una copia de seguridad completa de todos tus prompts y configuraciones en un archivo JSON portable.
*   **Importar Galería:** Restaura tus copias de seguridad en cualquier dispositivo o navegador. El sistema detecta duplicados automáticamente para fusionar librerías de forma segura.

---

## 🛡️ Privacidad y Seguridad

*   **API Key Local:** Tu clave de API se almacena exclusivamente en el `localStorage` de tu navegador. Nunca se envía a servidores intermedios.
*   **Facturación Directa:** Al usar tu propia clave, tienes control total sobre tus cuotas y facturación directamente con Google Cloud Platform.

---

## 🛠️ Stack Tecnológico

*   **Frontend:** React 19, TypeScript, Vite.
*   **Estilos:** Tailwind CSS con diseño "Glassmorphism".
*   **IA:** Google Gemini API (`gemini-2.5-flash` para texto/lógica, `gemini-2.5-flash-image` para visión).
*   **Iconos:** Componentes SVG personalizados optimizados.

---

### 📄 Licencia

Este proyecto es de código abierto bajo la Licencia MIT. ¡Siéntete libre de hacer fork y contribuir!
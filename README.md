
# Prompt Studio 🎨: Suite Profesional de Ingeniería de Prompts

**Prompt Studio** es la herramienta definitiva para creadores de IA generativa (Midjourney, Stable Diffusion, Flux, DALL-E). No es solo un editor; es un **Director Creativo Asistido por IA** que te ayuda a construir, refinar, fusionar y organizar prompts complejos con precisión quirúrgica.

Potenciada por **Google Gemini 2.5 / 3 Flash**, esta aplicación ofrece un flujo de trabajo modular y multimodal único.

---

## 🌟 Funcionalidades Principales

### 1. 🧬 Laboratorio de Fusión
Experimenta con la **"Alquimia Visual"**.
*   **Mezcla de Conceptos:** Sube hasta 3 imágenes o selecciona fragmentos de texto de tu galería.
*   **Síntesis Inteligente:** La IA analiza el "ADN visual" de cada referencia y genera un nuevo fragmento híbrido que combina lo mejor de cada fuente.
*   **Control del Usuario:** Añade instrucciones específicas (ej: "Conserva la luz de la imagen A pero usa la ropa de la imagen B") para guiar la fusión.

### 2. ✨ Refinador IA (Playground)
Transforma la edición de prompts en una conversación fluida.
*   **Chat en Tiempo Real:** Habla con la IA ("hazlo más oscuro", "cambia el estilo a cyberpunk") y observa cómo se actualizan los módulos al instante.
*   **Rol de Experto:** La IA actúa como un Ingeniero de Prompts Senior, expandiendo términos vagos en descripciones técnicas ricas en inglés.
*   **Feedback Visual:** Los módulos modificados se iluminan para que sepas exactamente qué ha cambiado.

### 3. 🚀 Editor Modular Avanzado
Descompón cualquier idea en **9 módulos estructurales** más un **Módulo Negativo**:
*   *Sujeto, Pose, Expresión, Outfit, Objeto, Escena, Color, Composición, Estilo.*
*   **Prompt Negativo Opcional:** Define qué evitar (ej: "borroso", "deforme") y guárdalo junto con tu prompt.
*   **Ensamblaje Optimizado:** Al generar el prompt final, la IA limpia redundancias, mejora la gramática y ordena lógicamente los elementos.

### 4. ☀️ Extractor Multimodal
Ingeniería inversa de imágenes.
*   Sube imágenes de referencia y extrae características aisladas (ej: solo la pose, solo la paleta de colores o solo el estilo artístico) para usarlas en tus propias creaciones.

### 5. 📚 Galería y Gestión de Activos
*   **Sistema de Fragmentos:** Guarda partes de prompts (ej: "Iluminación Cinematográfica") para reutilizarlas en el futuro.
*   **Búsqueda y Filtrado:** Encuentra rápidamente tus prompts híbridos, estilos o sujetos.
*   **Portabilidad:** Exporta toda tu galería a un archivo JSON para copias de seguridad o para compartirla entre dispositivos.

---

## 🛡️ Estabilidad y Observabilidad

Prompt Studio incorpora varias capas de fiabilidad que no son visibles al usuario pero mejoran significativamente la experiencia:

- **Error Boundaries:** Cada vista está envuelta en un Error Boundary que captura errores de renderizado, muestra un fallback con opción de reintentar y registra el stack trace en consola.
- **API Logging Estructurado:** Cada llamada a Gemini se registra en consola con `console.group` incluyendo modelo, tokens de entrada/salida y latencia en ms. Facilita el debugging sin herramientas externas.
- **Lazy Loading:** La Galería se carga bajo demanda mediante `React.lazy` + `Suspense`, reduciendo el bundle inicial.
- **Tests:** Suite de 39 tests (unit + integración) con Vitest y Testing Library. Cobertura de Error Boundary, servicios Gemini, y flujo Extractor → Editor.

---

## 🧠 Lógica de Optimización "Elite"

Prompt Studio no se limita a concatenar texto. Utiliza algoritmos de IA para:
1.  **Deduplicación:** Elimina repeticiones (ej: si el Sujeto dice "traje rojo" y el Outfit dice "traje rojo", lo fusiona).
2.  **Orden Lógico (JSON):** Al generar salidas JSON, fuerza un orden visual humano (Sujeto primero -> Estilo al final).
3.  **Preservación de Detalles:** Al adaptar fragmentos, respeta los términos técnicos y artísticos originales.

---

## 🛠️ Stack Tecnológico

*   **Frontend:** React 19, TypeScript 5.8, Vite 7.
*   **Estilos:** Tailwind CSS 3.4 — paneles sólidos por vista, glass para header/modals, acentos de color por sección.
*   **IA:** Google Gemini API (`@google/genai`) — `gemini-2.5-flash` para generación de texto, `gemini-2.5-flash-image` para generación de imágenes, `gemini-3-flash-preview` para análisis multimodal.
*   **Almacenamiento:** IndexedDB para prompts (con migración automática desde localStorage), localStorage para API key y configuración.
*   **Testing:** Vitest + @testing-library/react + jsdom.

---

## 🎨 Diseño

La interfaz utiliza un sistema de paneles con jerarquía visual clara:
*   **Header y modales:** Fondo glass (backdrop-blur) para transparencia y profundidad.
*   **Vistas principales:** Paneles sólidos con bordes sutiles para máximo contraste y legibilidad.
*   **Acentos por vista:** Teal (Extractor), violeta (Editor), esmeralda (Galería), ámbar (Fusión), cyan (Playground).
*   **Accesibilidad:** Navegación completa por teclado, roles ARIA, gestión de foco, y targets táctiles de 44×44px en móvil.

---

### 🛡️ Privacidad

Tu API Key se almacena **localmente en tu navegador** (localStorage). Tus prompts se guardan en **IndexedDB** del navegador. La aplicación conecta directamente con la API de Google, sin servidores intermedios que lean tus datos. Puedes exportar tu galería completa a JSON en cualquier momento.

---

## ⚖️ Licencia y Autoría

Este proyecto ha sido creado y es mantenido por **Victor Ramones**.

Distribuido bajo la licencia **GNU General Public License v3.0**.

**¿Qué significa esto?**
- Eres libre de usar, estudiar y modificar este código.
- **Atribución:** Debes citar siempre al autor original.
- **Copyleft:** Si mejoras o modificas este software y lo distribuyes, **estás obligado** a compartir esas mejoras bajo esta misma licencia. El uso comercial está permitido siempre que las modificaciones se distribuyan como código abierto bajo GPL v3.

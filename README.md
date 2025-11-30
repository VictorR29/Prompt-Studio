
# Prompt Studio 🎨: Suite Profesional de Ingeniería de Prompts

**Prompt Studio** es la herramienta definitiva para creadores de IA generativa (Midjourney, Stable Diffusion, Flux, DALL-E). No es solo un editor; es un **Director Creativo Asistido por IA** que te ayuda a construir, refinar, fusionar y organizar prompts complejos con precisión quirúrgica.

Potenciada por **Google Gemini 2.5**, esta aplicación ofrece un flujo de trabajo modular y multimodal único.

---

## 🌟 Funcionalidades Principales

### 1. 🧬 Laboratorio de Fusión (Nuevo)
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

## 🧠 Lógica de Optimización "Elite"

Prompt Studio no se limita a concatenar texto. Utiliza algoritmos de IA para:
1.  **Deduplicación:** Elimina repeticiones (ej: si el Sujeto dice "traje rojo" y el Outfit dice "traje rojo", lo fusiona).
2.  **Orden Lógico (JSON):** Al generar salidas JSON, fuerza un orden visual humano (Sujeto primero -> Estilo al final).
3.  **Preservación de Detalles:** Al adaptar fragmentos, respeta los términos técnicos y artísticos originales.

---

## 🛠️ Stack Tecnológico

*   **Frontend:** React 19, TypeScript, Vite.
*   **Estilos:** Tailwind CSS con diseño "Glassmorphism" y soporte móvil nativo (PWA-ready).
*   **IA:** Google Gemini API (`gemini-2.5-flash` para lógica/texto, `gemini-2.5-flash-image` para visión).
*   **Almacenamiento:** LocalStorage (Client-Side) para máxima privacidad.

---

### 🛡️ Privacidad

Tu API Key y tus prompts se almacenan **localmente en tu navegador**. La aplicación conecta directamente con la API de Google, sin servidores intermedios que lean tus datos.

---

### 📄 Licencia

Este proyecto es de código abierto bajo la Licencia MIT.

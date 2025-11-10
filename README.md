# Prompt Studio 🎨: Ingeniería de Prompts Modular e Inteligente

[![Estado del Proyecto](https://img.shields.io/badge/estado-en%20desarrollo-yellow.svg )](https://github.com/VictorR29/Prompt-Studio )[![GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-blue.svg )](https://victorr29.github.io/Prompt-Studio/ )[![Licencia](https://img.shields.io/badge/licencia-MIT-green.svg )](LICENSE)[![Tecnología](https://img.shields.io/badge/tecnología-IA%20Generativa%20|%20React-blueviolet.svg )](#)

**Prompt Studio** es la aplicación líder en **Ingeniería Inversa de Prompts** para la generación de imágenes con IA. Utiliza modelos avanzados de Gemini para **descomponer imágenes o texto en 9 fragmentos editables**, permitiéndote crear, mezclar y optimizar *prompts* con precisión quirúrgica.

Esta aplicación web fue programada usando **Vibe Coding** asistido por **Google AI Studio**.

![Captura de pantalla del Panel de Control Modular de Prompt Studio](https://raw.githubusercontent.com/VictorR29/Prompt-Studio/main/src/img/screenshot.png )
*(**Nota**: Reemplaza esta imagen con una captura de tu **Panel de Control Modular**.)*

---

## ✨ Características Principales y Funcionalidad Modular

Prompt Studio transforma la creación de *prompts* en un proceso estructurado y gestionable.

* **Análisis Inverso y Modularización (9 Fragmentos):** Descompón cualquier *prompt* de texto o JSON en **9 módulos editables** (Sujeto, Pose, Estilo, Composición, etc.) listos para ser modificados.
* **Extracción de Imagen Inteligente:** Analiza imágenes de referencia para extraer automáticamente los fragmentos clave de **Estilo, Paleta de Colores, Pose y Expresión**.
* **Ensamblaje Inteligente y Coherente:** El sistema aplica **Lógica de Prioridad y Filtrado** (Reglas Maestras) para eliminar redundancias y conflictos entre los fragmentos (ej., el color del Outfit vs. la Paleta de Colores) antes de generar el *prompt* final.
* **Optimización Contextual:** Recibe **sugerencias inteligentes** en tiempo real para cada módulo, basadas en el contexto del *prompt* completo que estás construyendo.
* **Gestión Avanzada de Galería:** Guarda y mezcla **Fragmentos Individuales** o **Prompts Maestros JSON completos**.
* **Fórmulas JSON y Preservación de Datos:** Importa estructuras JSON complejas y las guarda como plantillas reutilizables, asegurando que los metadatos y valores estructurales fijos (`seed`, `steps`) se conserven intactos en el *prompt* ensamblado.

---

## 🛡️ Seguridad y Tecnología Flexible

La aplicación está construida sobre una arquitectura que respeta la seguridad de tu clave API y te da control total sobre tu consumo.

* **Programado con Vibe Coding:** La *app* fue desarrollada utilizando **Google AI Studio** como co-piloto y entorno de programación asistida.
* **Seguridad por Defecto:** La aplicación utiliza una clave API segura, inyectada vía **variables de entorno**, por lo que **tu clave privada nunca se expone** en el código del lado del cliente.
* **Opción de Clave Propia:** Para uso intensivo o ilimitado, puedes ingresar tu propia clave API de Google en la sección de Configuración. Esta clave se almacena de forma segura en el `localStorage` de tu navegador, delegando el consumo de la API a tu propia cuota.

---

## 🛠️ Cómo Empezar

Para aprovechar las funciones de análisis y generación de *prompts*, solo necesitas una clave de API de Gemini.

1.  **Obtén tu API Key:**
    * Ve a [Google AI Studio](https://aistudio.google.com/).
    * Haz clic en "**Get API key**" para crear una nueva clave.

2.  **Configura tu Clave en Prompt Studio (Opcional):**
    * Abre la aplicación [Prompt Studio](https://victorr29.github.io/Prompt-Studio/).
    * Busca el ícono de configuración (⚙️) e ingresa tu clave para uso personal.

3.  **¡Empieza a Crear Arte!**
    * Usa el modo **Editor** para analizar un *prompt* existente, o el modo **Extracción** para empezar desde una imagen.
    * Presiona **"Generar Prompt Final"** y observa cómo la IA ensambla la obra maestra.

---

## 🖼️ Galería de Ejemplos (Próximamente)

*(Esta sección es ideal para mostrar algunas de las imágenes más impresionantes que tú o tus usuarios han creado con la aplicación. ¡Inspira a los demás!)*

## 🤝 ¿Quieres Contribuir?

Si eres un apasionado del arte con IA y quieres mejorar **Prompt Studio**, ¡tu ayuda es bienvenida!

1.  **Haz un Fork** del repositorio.
2.  **Crea una nueva Rama** para tu mejora (`git checkout -b feature/AmazingArtFeature`).
3.  **Haz tus Cambios** y haz commit (`git commit -m 'Add some AmazingArtFeature'`).
4.  **Haz Push** a tu rama (`git push origin feature/AmazingArtFeature`).
5.  **Abre un Pull Request**.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
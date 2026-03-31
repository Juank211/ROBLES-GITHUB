document.addEventListener('DOMContentLoaded', () => {
    // === CONFIGURACIÓN DE PRECIOS Y REGLAS ===
    const TARIFA_BASE = 450000;         // Valor por noche para 2 personas
    const TARIFA_PERSONA_EXTRA = 100000; // Valor por cada persona adicional
    const PERSONAS_BASE = 2;            // Cuántas personas cubre la tarifa base
    const PERSONAS_MIN = 2;             // Mínimo permitido
    const PERSONAS_MAX = 5;             // Máximo permitido (4 + 1 excepción)

    // Referencias a elementos del DOM
    // Referencias a elementos del DOM con Null Checks
    const header = document.querySelector('header');
    const entradaInput = document.getElementById('entrada');
    const salidaInput = document.getElementById('salida');
    const personasInput = document.getElementById('personas');
    const totalCostDisplay = document.getElementById('totalCost');
    const costoTotalHiddenInput = document.getElementById('costoTotalHidden');
    
    // Elementos del Modal y Formulario
    const mostrarFormularioBtn = document.getElementById('mostrarFormulario');
    const reservaSection = document.getElementById('reserva'); 
    const reservaForm = document.getElementById('reservaForm');
    const reservaContenido = document.getElementById('reservaContenido');
    const mensajeExito = document.getElementById('mensajeExitoReserva'); 
    const btnSeguirNavegando = document.getElementById('btnSeguirNavegando');
    const btnCerrarX = document.getElementById('cerrarModalX');
  
    // --- EFECTO STICKY HEADER ---
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('sticky');
            } else {
                header.classList.remove('sticky');
            }
        });
    }

    // --- EFECTO REVEAL ON SCROLL ---
    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    // Una vez visible, dejamos de observar
                    revealObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15
        });

        revealElements.forEach(el => revealObserver.observe(el));
    }  
    // --- LÓGICA DE IDIOMAS (i18n) ---
    function changeLanguage(lang) {
        if (!translations[lang]) return;

        // Actualizar todos los elementos con data-i18n
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang][key]) {
                el.innerText = translations[lang][key];
            }
        });

        // Actualizar placeholders
        const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
        placeholders.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (translations[lang][key]) {
                el.placeholder = translations[lang][key];
            }
        });

        // Actualizar estado visual de los botones
        document.querySelectorAll('.lang-switch span').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-${lang}`);
        if (activeBtn) activeBtn.classList.add('active');

        // Guardar preferencia
        localStorage.setItem('preferredLang', lang);
        window.currentLang = lang; // Para uso global (ej: mensajes de error)
    }

    // Exponer a global para los onclick en HTML
    window.changeLanguage = changeLanguage;

    // Cargar idioma preferido al inicio
    const savedLang = localStorage.getItem('preferredLang') || 'es';
    changeLanguage(savedLang);

    // 1. ABRIR Y CERRAR EL MODAL
    if (mostrarFormularioBtn) {
        mostrarFormularioBtn.addEventListener('click', (e) => {
            e.preventDefault();
            reservaSection.classList.add('active');
            // Resetear vistas al abrir
            reservaContenido.style.display = 'block';
            mensajeExito.style.display = 'none';
        });
    }
  
    // Cerrar con el botón "Cerrar" dentro del form
    if(btnCerrarX) {
        btnCerrarX.addEventListener('click', (e) => {
            e.preventDefault();
            reservaSection.classList.remove('active');
        });
    }

    // Cerrar al hacer click fuera del contenido (en el fondo oscuro)
    if (reservaSection) {
        reservaSection.addEventListener('click', (e) => {
            if (e.target === reservaSection) {
                reservaSection.classList.remove('active');
            }
        });
    }
  
    // 2. LÓGICA DE CÁLCULO DE COSTOS
    function calcularCostoTotal() {
        // Obtener valores
        const entrada = new Date(entradaInput.value);
        const salida = new Date(salidaInput.value);
        let personas = parseInt(personasInput.value);

        // Validaciones de seguridad
        if (isNaN(personas) || personas < PERSONAS_MIN) personas = PERSONAS_MIN;
        if (personas > PERSONAS_MAX) personas = PERSONAS_MAX;

        // Validar fechas
        if (isNaN(entrada) || isNaN(salida)) return 0;
        if (entrada >= salida) return 0; // La salida debe ser después de la entrada
  
        // Calcular número de noches
        const diferenciaTiempo = salida - entrada;
        const dias = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));
  
        // Lógica de Precio:
        // Base ($400k) + (Personas Extras * $75k)
        let costoPorNoche = TARIFA_BASE;
        
        if (personas > PERSONAS_BASE) {
            const personasExtra = personas - PERSONAS_BASE;
            costoPorNoche += (personasExtra * TARIFA_PERSONA_EXTRA);
        }
  
        const total = dias * costoPorNoche;
        return total > 0 ? total : 0;
    }
  
    function actualizarCostoUI() {
        const total = calcularCostoTotal();
        
        // Formato de moneda colombiana
        const totalFormateado = new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP',
            maximumFractionDigits: 0 
        }).format(total);

        // Calcular días para el texto
        const dias = Math.ceil((new Date(salidaInput.value) - new Date(entradaInput.value)) / (1000 * 60 * 60 * 24));

        if(total > 0 && dias > 0) {
            totalCostDisplay.textContent = `Costo total: ${totalFormateado} (${dias} noches)`;
            totalCostDisplay.style.color = "#D46B82"; // Color destacado
            totalCostDisplay.style.fontWeight = "bold";
            if (costoTotalHiddenInput) costoTotalHiddenInput.value = totalFormateado;
        } else {
            totalCostDisplay.textContent = 'Costo total: $0';
            totalCostDisplay.style.color = "#2f2f2f";
            if (costoTotalHiddenInput) costoTotalHiddenInput.value = '';
        }
    }
  
    // Escuchar cambios en los inputs para recalcular en tiempo real
    if (entradaInput && salidaInput && personasInput) {
        entradaInput.addEventListener('change', () => {
            actualizarCostoUI();
            verificarDisponibilidadSupabase(); // Llamada a Supabase
        });
        salidaInput.addEventListener('change', () => {
            actualizarCostoUI();
            verificarDisponibilidadSupabase(); // Llamada a Supabase
        });
        personasInput.addEventListener('input', actualizarCostoUI);
    }

    // 2.5 FUNCIONALIDAD SUPABASE (BLOQUEO DE FECHAS)
    async function verificarDisponibilidadSupabase() {
        const fechaEntrada = entradaInput.value;
        const fechaSalida = salidaInput.value;

        if (!fechaEntrada || !fechaSalida) return;

        try {
            // Consulta de solapamiento: (inicio_bloqueo <= fin_reserva) AND (fin_bloqueo >= inicio_reserva)
            const { data, error } = await supabaseClient
                .from('bloqueos_fechas')
                .select('*')
                .lte('fecha_inicio', fechaSalida)
                .gte('fecha_fin', fechaEntrada);

            if (error) throw error;

            let existingWarning = document.getElementById('supabase-blocked-warning');
            const submitBtn = reservaForm.querySelector('button[type="submit"]');

            if (data && data.length > 0) {
                const motivo = data[0].motivo || (window.currentLang === 'es' ? 'No disponible' : 'Not available');
                if (!existingWarning) {
                    existingWarning = document.createElement('div');
                    existingWarning.id = 'supabase-blocked-warning';
                    existingWarning.style.cssText = "color: #ff4d4d; background: #ffe6e6; padding: 10px; margin: 10px 0; border-radius: 5px; font-weight: bold; font-size: 0.9rem; text-align: center;";
                    reservaForm.insertBefore(existingWarning, document.getElementById('totalCost'));
                }
                
                existingWarning.innerText = window.currentLang === 'es' 
                    ? `⚠️ Esta fecha está bloqueada: ${motivo}` 
                    : `⚠️ This date is blocked: ${motivo}`;
                existingWarning.style.display = 'block';
                if (submitBtn) submitBtn.disabled = true;
            } else {
                if (existingWarning) existingWarning.style.display = 'none';
                if (submitBtn) submitBtn.disabled = false;
            }
        } catch (err) {
            console.error("Error al consultar bloqueos:", err);
        }
    }
  
    // 3. ENVÍO DEL FORMULARIO (AJAX - Sin recargar página)
    if (reservaForm) {
        reservaForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // EVITA que la página se recargue
            
            const total = calcularCostoTotal();
            if (total === 0) {
                alert('Por favor selecciona fechas válidas (mínimo 1 noche).');
                return;
            }

            const botonSubmit = reservaForm.querySelector('button[type="submit"]');
            const textoOriginal = botonSubmit.textContent;
            
            // Feedback visual de "Cargando"
            botonSubmit.textContent = 'Procesando solicitud...';
            botonSubmit.disabled = true;
            botonSubmit.style.backgroundColor = '#ccc'; // Gris visual

            const formData = new FormData(reservaForm);

            try {
                const response = await fetch(reservaForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 
                        'Accept': 'application/json' 
                    }
                });

                if (response.ok) {
                    // ÉXITO: Ocultar form, mostrar mensaje
                    reservaContenido.style.display = 'none';
                    mensajeExito.style.display = 'block';
                    
                    // Limpiar formulario
                    reservaForm.reset();
                    actualizarCostoUI();
                } else {
                    throw new Error('Error en el servidor de correo');
                }
            } catch (error) {
                alert('Hubo un problema de conexión. Por favor escríbenos al WhatsApp.');
                console.error(error);
            } finally {
                // Restaurar botón
                botonSubmit.textContent = textoOriginal;
                botonSubmit.disabled = false;
                botonSubmit.style.backgroundColor = ''; // Volver al color original
            }
        });
    }

    // 4. BOTÓN "SEGUIR NAVEGANDO" (Resetea el modal)
    if (btnSeguirNavegando) {
        btnSeguirNavegando.addEventListener('click', (e) => {
            e.preventDefault();
            reservaSection.classList.remove('active');
            
            // Esperar un poco y restaurar la vista del formulario para la próxima vez
            setTimeout(() => {
                reservaContenido.style.display = 'block';
                mensajeExito.style.display = 'none';
            }, 500);
        });
    }

    // --- MANTENER CÓDIGO DE GALERÍA / LIGHTBOX ---
    // (Asegura que tu galería de fotos siga funcionando)
    const imagenes = document.querySelectorAll(".galeria-grid img");
    const lightbox = document.getElementById("lightbox");
    const imgAmpliada = document.getElementById("img-ampliada");
    const cerrarLightbox = document.querySelector(".lightbox .cerrar");

    if (imagenes.length > 0 && lightbox) {
        imagenes.forEach(img => {
            img.addEventListener("click", () => {
                lightbox.style.display = "flex";
                if(imgAmpliada) imgAmpliada.src = img.src;
            });
        });

        if(cerrarLightbox) {
            cerrarLightbox.addEventListener("click", () => {
                lightbox.style.display = "none";
            });
        }

        lightbox.addEventListener("click", e => {
            if (e.target === lightbox) lightbox.style.display = "none";
        });
    }
    
    // Botón subir (Scroll Top)
    const scrollBtn = document.getElementById('scrollTopBtn');
    if (scrollBtn) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                scrollBtn.classList.add('show');
            } else {
                scrollBtn.classList.remove('show');
            }
        });
    }
});
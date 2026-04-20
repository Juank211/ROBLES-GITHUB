/**
 * Robles Penthouse - Reserva JS (Refactored)
 * Estructura Modular: PricingEngine, UIController, DataService
 */

document.addEventListener('DOMContentLoaded', () => {
    // === 1. DATASERVICE (Persistencia y Datos Externos) ===
    const DataService = {
        async keepAlive() {
            try {
                const { error } = await supabaseClient
                    .from('metricas_visitas')
                    .insert([{ timestamp: new Date().toISOString(), platform: 'web' }]);
                if (error) console.warn("KeepAlive Error:", error.message);
            } catch (err) {
                console.error("Critical KeepAlive Error:", err);
            }
        },

        async getAvailability(fechaEntrada, fechaSalida) {
            try {
                const { data, error } = await supabaseClient
                    .from('bloqueos_fechas')
                    .select('*')
                    .lte('fecha_inicio', fechaSalida)
                    .gte('fecha_fin', fechaEntrada);
                if (error) throw error;
                return data;
            } catch (err) {
                console.error("Error al consultar bloqueos:", err);
                return [];
            }
        },

        async fetchReviews() {
            const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTyI-KIKX9jCvoONguyc2ef7M-AlSKsuYgIIW4KWIsZyrDBJEaf21Zo1G950dXrjR-a3TATEDKdyvVq/pub?gid=0&single=true&output=csv";
            try {
                const response = await fetch(url);
                const csvData = await response.text();
                return this.parseCSV(csvData);
            } catch (err) {
                console.error("Error fetching reviews:", err);
                return null; // Fallback handled in UI
            }
        },

        parseCSV(csv) {
            const lines = csv.split('\n').filter(line => line.trim() !== '');
            const result = [];
            
            // Regex para separar por coma ignorando comas dentro de comillas
            const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(regex);
                if (cols.length >= 4) {
                    const starsRaw = cols[2].replace(/"/g, '').trim();
                    let stars = '★★★★★';
                    if (starsRaw.includes('4')) stars = '★★★★☆';
                    else if (starsRaw.includes('3')) stars = '★★★☆☆';
                    else if (starsRaw.includes('2')) stars = '★★☆☆☆';
                    else if (starsRaw.includes('1')) stars = '★☆☆☆☆';

                    const comment = cols[3].replace(/"/g, '').trim();
                    if (comment === '(sin comentario)' || comment === '') continue;

                    result.push({
                        nombre: cols[0].replace(/"/g, '').trim(),
                        fecha: cols[1].replace(/"/g, '').trim(),
                        estrellas: stars,
                        texto: comment
                    });
                }
            }
            return result;
        },

        async saveReservation(data) {
            try {
                const { error } = await supabaseClient
                    .from('reservas')
                    .insert([data]);
                if (error) throw error;
                return true;
            } catch (err) {
                console.error("Error saving to Supabase:", err);
                return false;
            }
        },

        sendConfirmationEmail(data) {
            // Webhook placeholder
            console.log('--- Disparando Webhook para Confirmación de Email ---');
            console.log('Datos de la reserva:', data);
        }
    };

    // === 2. PRICINGENGINE (Lógica de Negocio) ===
    const PricingEngine = {
        CONFIG: {
            TARIFA_BASE: 450000,
            TARIFA_PERSONA_EXTRA: 100000,
            PERSONAS_BASE: 2,
            PERSONAS_MIN: 2,
            PERSONAS_MAX: 5
        },

        calcular(entradaStr, salidaStr, personas) {
            const entrada = new Date(entradaStr);
            const salida = new Date(salidaStr);
            let numPersonas = parseInt(personas);

            if (isNaN(numPersonas) || numPersonas < this.CONFIG.PERSONAS_MIN) numPersonas = this.CONFIG.PERSONAS_MIN;
            if (numPersonas > this.CONFIG.PERSONAS_MAX) numPersonas = this.CONFIG.PERSONAS_MAX;

            if (isNaN(entrada) || isNaN(salida) || entrada >= salida) return { total: 0, noches: 0 };

            const noches = Math.ceil((salida - entrada) / (1000 * 60 * 60 * 24));
            let costoPorNoche = this.CONFIG.TARIFA_BASE;

            if (numPersonas > this.CONFIG.PERSONAS_BASE) {
                const extras = numPersonas - this.CONFIG.PERSONAS_BASE;
                costoPorNoche += (extras * this.CONFIG.TARIFA_PERSONA_EXTRA);
            }

            return { total: noches * costoPorNoche, noches };
        }
    };

    // === 3. UICONTROLLER (Interacciones y DOM) ===
    const UIController = {
        iti: null,
        elements: {
            header: document.querySelector('header'),
            entrada: document.getElementById('entrada'),
            salida: document.getElementById('salida'),
            personas: document.getElementById('personas'),
            totalCost: document.getElementById('totalCost'),
            costoHidden: document.getElementById('costoTotalHidden'),
            mostrarBtn: document.getElementById('mostrarFormulario'),
            reservaSection: document.getElementById('reserva'),
            reservaForm: document.getElementById('reservaForm'),
            reservaContenido: document.getElementById('reservaContenido'),
            mensajeExito: document.getElementById('mensajeExitoReserva'),
            btnSeguir: document.getElementById('btnSeguirNavegando'),
            btnCerrarX: document.getElementById('cerrarModalX'),
            phoneInput: document.getElementById('telefonoReserva'),
            reviewsGrid: document.querySelector('.grid-reseñas'),
            scrollBtn: document.getElementById('scrollTopBtn'),
            menuToggle: document.getElementById('menuToggle'),
            menuClose: document.getElementById('menuClose'),
            mobileNav: document.getElementById('mobileNav')
        },

        init() {
            this.setupStickyHeader();
            this.setupRevealOnScroll();
            this.setupModals();
            this.setupGallery();
            this.setupScrollTop();
            this.setupMobileMenu();
            this.setupI18n();
            this.setupTelInput();
            this.bindEvents();
            this.loadReviews();
        },

        setupTelInput() {
            if (this.elements.phoneInput) {
                this.iti = window.intlTelInput(this.elements.phoneInput, {
                    initialCountry: "co",
                    separateDialCode: true,
                    utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.10/build/js/utils.js",
                });
            }
        },

        setupStickyHeader() {
            if (this.elements.header) {
                window.addEventListener('scroll', () => {
                    this.elements.header.classList.toggle('sticky', window.scrollY > 50);
                });
            }
        },

        setupRevealOnScroll() {
            const revealElements = document.querySelectorAll('.reveal');
            if (revealElements.length > 0) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('visible');
                            observer.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.15 });
                revealElements.forEach(el => observer.observe(el));
            }
        },

        setupModals() {
            const { mostrarBtn, reservaSection, reservaContenido, mensajeExito, btnCerrarX, btnSeguir } = this.elements;

            if (mostrarBtn) {
                mostrarBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    reservaSection.classList.add('active');
                    reservaContenido.style.display = 'block';
                    mensajeExito.style.display = 'none';
                });
            }

            const closeModal = () => reservaSection.classList.remove('active');

            if (btnCerrarX) btnCerrarX.addEventListener('click', closeModal);
            if (reservaSection) {
                reservaSection.addEventListener('click', (e) => {
                    if (e.target === reservaSection) closeModal();
                });
            }

            if (btnSeguir) {
                btnSeguir.addEventListener('click', (e) => {
                    e.preventDefault();
                    closeModal();
                    setTimeout(() => {
                        reservaContenido.style.display = 'block';
                        mensajeExito.style.display = 'none';
                    }, 500);
                });
            }
        },

        setupGallery() {
            const imagenes = document.querySelectorAll(".galeria-grid img");
            const lightbox = document.getElementById("lightbox");
            const imgAmpliada = document.getElementById("img-ampliada");
            const cerrarLightbox = document.querySelector(".lightbox .cerrar");

            if (imagenes.length > 0 && lightbox) {
                imagenes.forEach(img => {
                    img.addEventListener("click", () => {
                        lightbox.style.display = "flex";
                        if (imgAmpliada) imgAmpliada.src = img.src;
                    });
                });
                if (cerrarLightbox) cerrarLightbox.addEventListener("click", () => lightbox.style.display = "none");
                lightbox.addEventListener("click", e => { if (e.target === lightbox) lightbox.style.display = "none"; });
            }
        },

        setupScrollTop() {
            if (this.elements.scrollBtn) {
                window.addEventListener('scroll', () => {
                    this.elements.scrollBtn.classList.toggle('show', window.scrollY > 300);
                });
            }
        },

        setupMobileMenu() {
            const { menuToggle, menuClose, mobileNav } = this.elements;
            if (menuToggle && mobileNav) {
                menuToggle.addEventListener('click', () => {
                    mobileNav.classList.add('active');
                    document.body.style.overflow = 'hidden';
                });
            }
            if (menuClose && mobileNav) {
                menuClose.addEventListener('click', () => {
                    mobileNav.classList.remove('active');
                    document.body.style.overflow = 'auto';
                });
            }
            document.querySelectorAll('#mobileNav a').forEach(link => {
                link.addEventListener('click', () => {
                    if (mobileNav) {
                        mobileNav.classList.remove('active');
                        document.body.style.overflow = 'auto';
                    }
                });
            });
        },

        setupI18n() {
            window.changeLanguage = (lang) => {
                if (!translations[lang]) return;
                document.querySelectorAll('[data-i18n]').forEach(el => {
                    const key = el.getAttribute('data-i18n');
                    if (translations[lang][key]) el.innerText = translations[lang][key];
                });
                document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                    const key = el.getAttribute('data-i18n-placeholder');
                    if (translations[lang][key]) el.placeholder = translations[lang][key];
                });
                document.querySelectorAll('.lang-switch span').forEach(btn => btn.classList.remove('active'));
                const activeBtn = document.getElementById(`btn-${lang}`);
                if (activeBtn) activeBtn.classList.add('active');
                localStorage.setItem('preferredLang', lang);
                window.currentLang = lang;
            };

            const savedLang = localStorage.getItem('preferredLang') || 'es';
            window.changeLanguage(savedLang);
        },

        bindEvents() {
            const { entrada, salida, personas, reservaForm } = this.elements;

            const updatePrice = () => this.actualizarCostoUI();
            const checkAvail = () => this.verificarDisponibilidadUI();

            if (entrada && salida && personas) {
                entrada.addEventListener('change', () => { updatePrice(); checkAvail(); });
                salida.addEventListener('change', () => { updatePrice(); checkAvail(); });
                personas.addEventListener('input', updatePrice);
            }

            if (reservaForm) {
                reservaForm.addEventListener('submit', (e) => this.handleSubmit(e));
            }
        },

        actualizarCostoUI() {
            const { entrada, salida, personas, totalCost, costoHidden } = this.elements;
            const res = PricingEngine.calcular(entrada.value, salida.value, personas.value);

            const totalFormateado = new Intl.NumberFormat('es-CO', {
                style: 'currency', currency: 'COP', maximumFractionDigits: 0
            }).format(res.total);

            if (res.total > 0 && res.noches > 0) {
                totalCost.textContent = `Costo total: ${totalFormateado} (${res.noches} noches)`;
                totalCost.style.color = "#D46B82";
                totalCost.style.fontWeight = "bold";
                if (costoHidden) costoHidden.value = totalFormateado;
            } else {
                totalCost.textContent = 'Costo total: $0';
                totalCost.style.color = "#2f2f2f";
                if (costoHidden) costoHidden.value = '';
            }
        },

        async verificarDisponibilidadUI() {
            const { entrada, salida, reservaForm } = this.elements;
            if (!entrada.value || !salida.value) return;

            const data = await DataService.getAvailability(entrada.value, salida.value);
            let warning = document.getElementById('supabase-blocked-warning');
            const submitBtn = reservaForm.querySelector('button[type="submit"]');

            if (data && data.length > 0) {
                const motivo = data[0].motivo || (window.currentLang === 'es' ? 'No disponible' : 'Not available');
                if (!warning) {
                    warning = document.createElement('div');
                    warning.id = 'supabase-blocked-warning';
                    warning.style.cssText = "color: #ff4d4d; background: #ffe6e6; padding: 10px; margin: 10px 0; border-radius: 5px; font-weight: bold; font-size: 0.9rem; text-align: center;";
                    reservaForm.insertBefore(warning, document.getElementById('totalCost'));
                }
                warning.innerText = window.currentLang === 'es' ? `⚠️ Esta fecha está bloqueada: ${motivo}` : `⚠️ This date is blocked: ${motivo}`;
                warning.style.display = 'block';
                if (submitBtn) submitBtn.disabled = true;
            } else {
                if (warning) warning.style.display = 'none';
                if (submitBtn) submitBtn.disabled = false;
            }
        },

        async handleSubmit(event) {
            event.preventDefault();
            const { entrada, salida, personas, reservaForm, reservaContenido, mensajeExito } = this.elements;
            
            // 1. Validación de Pricing
            const res = PricingEngine.calcular(entrada.value, salida.value, personas.value);
            if (res.total === 0) {
                alert(window.currentLang === 'es' ? 'Por favor selecciona fechas válidas (mínimo 1 noche).' : 'Please select valid dates.');
                return;
            }

            // 2. Validación de Teléfono Internacional
            if (!this.iti.isValidNumber()) {
                alert(window.currentLang === 'es' ? 'Por favor ingresa un número de teléfono válido para el país seleccionado.' : 'Please enter a valid phone number.');
                return;
            }

            const btn = reservaForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = window.currentLang === 'es' ? 'Procesando...' : 'Processing...';
            btn.disabled = true;

            const formData = new FormData(reservaForm);
            // Sobrescribir teléfono con el formato internacional completo
            formData.set('telefono', this.iti.getNumber());

            try {
                const response = await fetch(reservaForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    const reservationData = {
                        nombre: formData.get('nombre'),
                        telefono: formData.get('telefono'),
                        fecha_entrada: formData.get('fecha_entrada'),
                        fecha_salida: formData.get('fecha_salida'),
                        num_personas: formData.get('numero_personas'),
                        costo_total: formData.get('costo_total'),
                        created_at: new Date().toISOString()
                    };

                    // Registro en Supabase
                    await DataService.saveReservation(reservationData);

                    reservaContenido.style.display = 'none';
                    mensajeExito.style.display = 'block';
                    
                    // Webhook (Task 5)
                    DataService.sendConfirmationEmail(reservationData);

                    reservaForm.reset();
                    this.actualizarCostoUI();
                } else {
                    throw new Error('Error en el servidor');
                }
            } catch (error) {
                alert(window.currentLang === 'es' ? 'Hubo un problema. Contacta por WhatsApp.' : 'Connection error. Contact us via WhatsApp.');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        },

        async loadReviews() {
            const dynamicReviews = await DataService.fetchReviews();
            if (dynamicReviews && dynamicReviews.length > 0) {
                this.renderReviews(dynamicReviews);
            }
        },

        renderReviews(reviews) {
            const { reviewsGrid } = this.elements;
            if (!reviewsGrid) return;

            // Clear current static reviews (as per requirement: use static as fallback)
            reviewsGrid.innerHTML = '';

            reviews.forEach(rev => {
                const card = document.createElement('div');
                card.className = 'tarjeta-reseña';
                card.innerHTML = `
                    <div class="encabezado-reseña">
                        <div class="icono-usuario"><i class="fas fa-user-circle"></i></div>
                        <div class="info-usuario">
                            <h3>${rev.nombre}</h3>
                            <span class="fecha-reseña">${rev.fecha}</span>
                        </div>
                        <div class="estrellas">${rev.estrellas}</div>
                    </div>
                    <p class="texto-reseña">"${rev.texto}"</p>
                `;
                reviewsGrid.appendChild(card);
            });
        }
    };

    // === EJECUCIÓN INICIAL ===
    DataService.keepAlive();
    UIController.init();
});
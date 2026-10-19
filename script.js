// 1. PROTEÇÃO DE ESCOPO: Envolvendo todo o código em uma IIFE (Immediately Invoked Function Expression)
// Isso impede que qualquer variável ou lista seja acessada ou modificada pelo console do navegador.
(() => {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {

        /* ==========================================================================
           2. Variáveis de Estado Totalmente Protegidas
           ========================================================================== */
        let produtosOriginais = [];
        let produtosAgrupados = [];
        let produtosFiltrados = [];
        let modalProdutosLista = [];

        let currentIndex = 0;
        let zoomLevel = 1.0;
        let isZoomed = false;
        let lastTap = 0;

        let produtosExibidosQuantidade = 8;
        let categoriaAtualAtiva = "todos";

        const container = document.getElementById("catalogo-container");
        const modal = document.getElementById("imageModal");
        const imgExpanded = document.getElementById("imgExpanded");
        const zoomContainer = document.querySelector(".zoom-container");
        const productTitle = document.getElementById("productTitle");
        const productPriceModal = document.getElementById("productPriceModal");
        const zoomIndicator = document.getElementById("zoomIndicator");
        const menuList = document.querySelector('.menu');
        const botaoMenu = document.querySelector('.botao-menu');

        if (botaoMenu && menuList) {
            botaoMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                menuList.classList.toggle('ativo');
            });

            document.addEventListener('click', () => {
                menuList.classList.remove('ativo');
            });
        }

        function sanitizarTexto(texto) {
            if (typeof texto !== 'string') return '';
            const div = document.createElement('div');
            div.innerText = texto;
            return div.innerHTML;
        }

        function sanitizarURL(url) {
            if (typeof url !== 'string') return '';
            if (url.trim().toLowerCase().startsWith('javascript:')) return '';
            return encodeURI(url);
        }

        function formatarPreco(valor) {
            const numero = Number(valor);
            return isNaN(numero) ? "R$ 0,00" : numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        /* ==========================================================================
           3. TRATAMENTO DE FALHA NO CARREGAMENTO (JSON)
           ========================================================================== */
        async function inicializarCatalogo() {
            try {
                const resposta = await fetch("produtos.json");

                // Se o arquivo JSON não for encontrado ou estiver corrompido
                if (!resposta.ok) throw new Error("Não foi possível carregar o arquivo de dados.");

                const dadosBrutos = await resposta.json();

                produtosOriginais = dadosBrutos.map(p => {
                    return {
                        nomeCompleto: sanitizarTexto(p.nome),
                        imagem: sanitizarURL(p.imagem),
                        categoria: sanitizarTexto(p.categoria),
                        preco: typeof p.preco === 'number' ? p.preco : 0,
                        badge: p.badge ? sanitizarTexto(p.badge) : "",
                        cores: Array.isArray(p.cores) ? p.cores.map(c => sanitizarTexto(String(c).trim())) : [],
                        tamanhos: Array.isArray(p.tamanhos) ? p.tamanhos.map(t => sanitizarTexto(String(t).trim())) : []
                    };
                });

                const mapaAgrupado = {};
                produtosOriginais.forEach(p => {
                    const partes = p.nomeCompleto.split('/');
                    const nomeBase = partes.length > 0 ? partes[0].trim() : p.nomeCompleto;

                    if (!mapaAgrupado[nomeBase]) {
                        mapaAgrupado[nomeBase] = {
                            nomeBase: nomeBase,
                            categoria: p.categoria,
                            variantes: []
                        };
                    }
                    mapaAgrupado[nomeBase].variantes.push(p);
                });

                produtosAgrupados = Object.values(mapaAgrupado);
                produtosFiltrados = [...produtosAgrupados];

                criarBotaoCarregarMais();
                criarBotaoVoltarAoTopo();
                renderizarCatalogo("todos");
                configurarFiltrosMenu();
            } catch (erro) {
                console.error("Erro ao inicializar o catálogo:", erro);
                exibirMensagemErroInterface();
            }
        }

        // Nova função para avisar o cliente em caso de instabilidade no servidor
        function exibirMensagemErroInterface() {
            if (!container) return;
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #555;">
                    <p style="font-size: 1.2rem; font-weight: 600; margin-bottom: 10px;">Catálogo Temporariamente Indisponível</p>
                    <p style="font-size: 0.9rem;">Estamos atualizando nossos produtos. Por favor, tente novamente em instantes.</p>
                </div>
            `;
        }

        /* ==========================================================================
           4. LÓGICA DO BOTÃO "CARREGAR MAIS" CORRIGIDA
           ========================================================================== */
        function criarBotaoCarregarMais() {
            if (document.getElementById("btn-carregar-mais")) return;
            if (!container) return;

            const btnContainer = document.createElement("div");
            btnContainer.classList.add("container-botao-carregar");

            const contadorTexto = document.createElement("p");
            contadorTexto.id = "contador-produtos-texto";
            contadorTexto.classList.add("contador-produtos-estilo");
            btnContainer.appendChild(contadorTexto);

            const botao = document.createElement("button");
            botao.id = "btn-carregar-mais";
            botao.textContent = "Carregar Mais Produtos";
            botao.classList.add("botao-carregar-mais-estilo");

            botao.addEventListener("click", () => {
                const quantidadeAnterior = produtosExibidosQuantidade;
                produtosExibidosQuantidade += 8;
                renderizarCatalogo(categoriaAtualAtiva, quantidadeAnterior, subcategoriaAtualAtiva);
            });

            btnContainer.appendChild(botao);
            container.parentNode.insertBefore(btnContainer, container.nextSibling);
        }

        function gerenciarVisibilidadeBotao(totalItensExibidos, totalItensFiltrados) {
            const botao = document.getElementById("btn-carregar-mais");
            const contador = document.getElementById("contador-produtos-texto");
            if (!botao || !contador) return;

            contador.textContent = `Exibindo ${totalItensExibidos} de ${totalItensFiltrados} produtos`;

            // CORREÇÃO: O botão agora funciona e desaparece corretamente em todas as categorias (incluindo "todos")
            if (totalItensExibidos >= totalItensFiltrados) {
                botao.style.display = "none";
            } else {
                botao.style.display = "inline-block";
            }
            contador.style.display = "block";
        }

        function criarBotaoVoltarAoTopo() {
            if (document.getElementById("btn-voltar-topo")) return;

            const botaoTopo = document.createElement("button");
            botaoTopo.id = "btn-voltar-topo";
            botaoTopo.innerHTML = "&#8593;";
            botaoTopo.title = "Voltar ao topo";

            botaoTopo.addEventListener("click", () => {
                window.scrollTo({ top: 0, behavior: "smooth" });
            });

            document.body.appendChild(botaoTopo);

            window.addEventListener("scroll", () => {
                if (window.scrollY > 400) {
                    botaoTopo.classList.add("visivel");
                } else {
                    botaoTopo.classList.remove("visivel");
                }
            });
        }

        /* ==========================================================================
           5. RENDERIZAÇÃO OTIMIZADA (FIM DOS LOOPS ANINHADOS E INSERÇÃO ÚNICA)
           ========================================================================== */
        /* ==========================================================================
           MODIFICADO: Suporte a Categorias e Subcategorias com Paginação Integrada
           ========================================================================== */
        let subcategoriaAtualAtiva = "todas";

        function renderizarCatalogo(categoriaFiltro = "todos", quantidadeAnterior = 0, subcategoriaFiltro = "todas") {
            if (!container) return;
            container.innerHTML = "";
            categoriaAtualAtiva = categoriaFiltro;
            subcategoriaAtualAtiva = subcategoriaFiltro;

            // Filtragem inteligente por categoria Pai e Subcategoria (via nome base ou propriedade)
            // Filtragem inteligente por categoria Pai e Subcategoria (via nome base ou propriedade)

             if (categoriaFiltro !== "todos") {
                produtosFiltrados = produtosAgrupados.filter(p => {
                    const pertenceCategoria = p.categoria.toLowerCase() === categoriaFiltro.toLowerCase();
                    if (!pertenceCategoria) return false;
                    
                    if (subcategoriaFiltro !== "todas") {
                        const nomeProd = p.nomeBase.toLowerCase();
                        
                        // REGRA ADICIONADA: Se filtrar por biquíni, aceita também "top", "cortininha" e "cortinão"
                        if (subcategoriaFiltro.toLowerCase() === "biquíni") {
                            return nomeProd.includes("biquíni") || 
                                   nomeProd.includes("biquini") || 
                                   nomeProd.includes("top") || 
                                   nomeProd.includes("cortininha") || 
                                   nomeProd.includes("cortinão") || 
                                   nomeProd.includes("cortinao"); // Prevenção sem acento
                        }
                        
                        // Filtro padrão para as demais subcategorias (calça, saída, maio)
                        return nomeProd.includes(subcategoriaFiltro.toLowerCase());
                    }
                    return true;
                });
            } else {
                produtosFiltrados = [...produtosAgrupados];
            }

            modalProdutosLista = [];
            produtosFiltrados.forEach(prod => {
                prod.variantes.forEach(v => {
                    modalProdutosLista.push(v);
                });
            });

            const totalItensFiltrados = produtosFiltrados.length;
            const produtosParaExibir = produtosFiltrados.slice(0, produtosExibidosQuantidade);

            const fragmentoGeral = document.createDocumentFragment();
            const categoriasUnicas = [...new Set(produtosParaExibir.map(p => p.categoria))];
            const blocosMap = {};

            categoriasUnicas.forEach(cat => {
                const secaoCategoria = document.createElement("div");
                secaoCategoria.classList.add("categoria-bloco");
                const tituloCategoria = document.createElement("h2");

                // Exibe o título dinâmico se houver subcategoria ativa
                if (subcategoriaFiltro !== "todas" && cat.toLowerCase() === categoriaFiltro.toLowerCase()) {
                    tituloCategoria.textContent = `${cat} - ${subcategoriaFiltro}`;
                } else {
                    tituloCategoria.textContent = cat;
                }

                tituloCategoria.classList.add("categoria-titulo");
                const gridProdutos = document.createElement("div");
                gridProdutos.classList.add("grid-produtos");
                secaoCategoria.appendChild(tituloCategoria);
                secaoCategoria.appendChild(gridProdutos);
                blocosMap[cat] = gridProdutos;
                fragmentoGeral.appendChild(secaoCategoria);
            });

            let contadorItemGlobal = 0;
            produtosParaExibir.forEach((prod) => {
                const gridDestino = blocosMap[prod.categoria];
                if (!gridDestino) return;
                const card = document.createElement("div");
                card.classList.add("produto-card");
                if (contadorItemGlobal >= quantidadeAnterior) {
                    card.classList.add("fade-in-novo-item");
                } else {
                    card.classList.add("fade-in-animacao");
                }
                contadorItemGlobal++;
                let varianteAtivaIndex = 0;
                const imgContainer = document.createElement("div");
                imgContainer.classList.add("img-container-card");
                const badgeElement = document.createElement("span");
                badgeElement.classList.add("product-badge");
                badgeElement.style.display = "none";
                const camadaProtecao = document.createElement("div");
                camadaProtecao.classList.add("camada-protecao-imagem");
                const imgElement = document.createElement("img");
                imgElement.loading = "lazy";
                imgElement.classList.add("product-img");
                const btnPrev = document.createElement("button");
                btnPrev.classList.add("card-nav-btn", "card-prev-btn");
                btnPrev.innerHTML = "❮";
                btnPrev.style.display = "none";
                const btnNext = document.createElement("button");
                btnNext.classList.add("card-nav-btn", "card-next-btn");
                btnNext.innerHTML = "❯";
                btnNext.style.display = "none";
                imgContainer.appendChild(badgeElement);
                imgContainer.appendChild(camadaProtecao);
                imgContainer.appendChild(imgElement);
                imgContainer.appendChild(btnPrev);
                imgContainer.appendChild(btnNext);
                const infoBloco = document.createElement("div");
                infoBloco.classList.add("produto-info-bloco");
                const titleElement = document.createElement("h3");
                titleElement.classList.add("product-title-text");
                const priceElement = document.createElement("div");
                priceElement.classList.add("product-price");
                const containerCores = document.createElement("div");
                containerCores.classList.add("product-colors-container");
                const tamanhosElement = document.createElement("div");
                tamanhosElement.classList.add("product-attribute-text", "product-sizes-list");
                infoBloco.appendChild(titleElement);
                infoBloco.appendChild(priceElement);
                infoBloco.appendChild(containerCores);
                infoBloco.appendChild(tamanhosElement);
                card.appendChild(imgContainer);
                card.appendChild(infoBloco);

                function atualizarVisualCard() {
                    const v = prod.variantes[varianteAtivaIndex];
                    if (!v) return;
                    imgElement.classList.remove("foto-ativa");
                    void imgElement.offsetWidth;
                    imgElement.src = v.imagem;
                    imgElement.alt = v.nomeCompleto;
                    imgElement.classList.add("foto-ativa");
                    titleElement.textContent = prod.nomeBase;
                    priceElement.textContent = formatarPreco(v.preco);
                    if (v.badge) {
                        badgeElement.textContent = v.badge;
                        badgeElement.className = "product-badge " + (v.badge.toLowerCase() === "lançamento" ? "badge-lancamento" : "badge-destaque");
                        badgeElement.style.display = "block";
                    } else {
                        badgeElement.style.display = "none";
                    }
                    containerCores.innerHTML = "";
                    if (prod.variantes && prod.variantes.length > 0) {
                        const labelCores = document.createElement("span");
                        labelCores.classList.add("product-attribute-label");
                        labelCores.textContent = "Cor: ";
                        containerCores.appendChild(labelCores);
                        const todasCoresDoGrupo = [...new Set(prod.variantes.flatMap(variant => variant.cores || []))];
                        todasCoresDoGrupo.forEach((cor, index) => {
                            const btnCor = document.createElement("button");
                            btnCor.classList.add("btn-tag-cor");
                            btnCor.textContent = cor;
                            if (varianteAtivaIndex === index) {
                                btnCor.classList.add("ativo");
                            }
                            btnCor.addEventListener("click", (e) => {
                                e.stopPropagation();
                                if (index < prod.variantes.length) {
                                    varianteAtivaIndex = index;
                                    atualizarVisualCard();
                                }
                            });
                            containerCores.appendChild(btnCor);
                        });
                        containerCores.style.display = "flex";
                    } else {
                        containerCores.style.display = "none";
                    }
                    if (v.tamanhos && v.tamanhos.length > 0) {
                        tamanhosElement.textContent = `Tamanho: ${v.tamanhos.join(" / ")}`;
                        tamanhosElement.style.display = "block";
                    } else {
                        tamanhosElement.style.display = "none";
                    }
                    if (prod.variantes.length > 1) {
                        btnPrev.style.display = "flex";
                        btnNext.style.display = "flex";
                    } else {
                        btnPrev.style.display = "none";
                        btnNext.style.display = "none";
                    }
                }
                atualizarVisualCard();
                btnPrev.addEventListener("click", (e) => {
                    e.stopPropagation();
                    varianteAtivaIndex = (varianteAtivaIndex - 1 + prod.variantes.length) % prod.variantes.length;
                    atualizarVisualCard();
                });
                btnNext.addEventListener("click", (e) => {
                    e.stopPropagation();
                    varianteAtivaIndex = (varianteAtivaIndex + 1) % prod.variantes.length;
                    atualizarVisualCard();
                });
                card.addEventListener("click", () => {
                    const nomeVarianteAlvo = prod.variantes[varianteAtivaIndex].nomeCompleto;
                    const indiceNoModalLista = modalProdutosLista.findIndex(p => p.nomeCompleto === nomeVarianteAlvo);
                    openModal(indiceNoModalLista);
                });
                gridDestino.appendChild(card);
            });
            container.appendChild(fragmentoGeral);
            gerenciarVisibilidadeBotao(produtosParaExibir.length, totalItensFiltrados);
        }
        /* Modificado para suportar cliques nos submenus e fechamento automático */
        function configurarFiltrosMenu() {
            const linksMenu = document.querySelectorAll('.menu a:not(.dropdown-toggle)');
            const togglesDropdown = document.querySelectorAll('.dropdown-toggle');
            // Gerencia abertura dos submenus no mobile/desktop clique
            togglesDropdown.forEach(toggle => {
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const pai = toggle.parentElement;
                    pai.classList.toggle('aberto');
                });
            });
            linksMenu.forEach(link => {
                link.addEventListener('click', (e) => {
                    const textoBotao = link.textContent.trim().toLowerCase();
                    produtosExibidosQuantidade = 8;
                    // Remove classes ativas de todos os links, inclusive submenus
                    document.querySelectorAll('.menu a').forEach(l => l.classList.remove('ativo'));
                    const paiCategoria = link.getAttribute('data-pai');
                    const subCategoria = link.getAttribute('data-sub');
                    if (paiCategoria && subCategoria) {
                        // Clicou em uma subcategoria específica
                        e.preventDefault();
                        link.classList.add('ativo');
                        link.closest('.dropdown').querySelector('.dropdown-toggle').classList.add('ativo');
                        renderizarCatalogo(paiCategoria, 0, subCategoria);
                    } else {
                        // Clicou em um link principal (Início, Produtos, Lingerie)
                        if (textoBotao === "início" || textoBotao === "inicio" || textoBotao === "produtos") {
                            renderizarCatalogo("todos", 0, "todas");
                        } else {
                            e.preventDefault();
                            renderizarCatalogo(textoBotao, 0, "todas");
                        }
                        link.classList.add('ativo');
                    }
                    // Fecha menus expansivos mobile
                    if (menuList) menuList.classList.remove('ativo');
                    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('aberto'));
                });
            });
        }
        function openModal(index) {
            if (index < 0 || index >= modalProdutosLista.length) return;
            currentIndex = index;
            updateModalContent();
            if (modal) modal.style.display = "flex";
            document.body.style.overflow = "hidden";
        }
        function closeModal() {
            if (modal) modal.style.display = "none";
            document.body.style.overflow = "";
            resetZoom();
        }
        function nextImagem() {
            if (modalProdutosLista.length === 0) return;
            currentIndex = (currentIndex + 1) % modalProdutosLista.length;
            updateModalContent();
        }
        function prevImagem() {
            if (modalProdutosLista.length === 0) return;
            currentIndex = (currentIndex - 1 + modalProdutosLista.length) % modalProdutosLista.length;
            updateModalContent();
        }
        function updateModalContent() {
            const itemAtivo = modalProdutosLista[currentIndex];
            if (!itemAtivo) return;
            if (imgExpanded) imgExpanded.src = itemAtivo.imagem;
            if (productTitle) {
                productTitle.textContent = itemAtivo.nomeCompleto;
            }
            if (productTitle) {
                const seletorCorAntigo = document.getElementById("modalProductColor");
                if (seletorCorAntigo) seletorCorAntigo.remove();
                let corDaFoto = "";
                if (itemAtivo.cores && itemAtivo.cores.length > 0) {
                    const indiceCor = currentIndex % itemAtivo.cores.length;
                    corDaFoto = itemAtivo.cores[indiceCor];
                }
                if (corDaFoto) {
                    const tagCor = document.createElement("div");
                    tagCor.id = "modalProductColor";
                    tagCor.className = "modal-product-color-badge";
                    tagCor.textContent = `Cor: ${corDaFoto}`;
                    productTitle.parentNode.insertBefore(tagCor, productTitle.nextSibling);
                }
            }
            if (productPriceModal) productPriceModal.textContent = formatarPreco(itemAtivo.preco);
            resetZoom();
        }
        function moverZoom(clientX, clientY) {
            if (!imgExpanded || !zoomContainer) return;
            const rect = zoomContainer.getBoundingClientRect();
            let x = ((clientX - rect.left) / rect.width) * 100;
            let y = ((clientY - rect.top) / rect.height) * 100;
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));
            imgExpanded.style.transformOrigin = `${x}% ${y}%`;
            imgExpanded.style.transform = `scale(${zoomLevel})`;
        }
        function resetZoom() {
            isZoomed = false;
            zoomLevel = 1.0;
            if (imgExpanded) {
                imgExpanded.style.transformOrigin = "center center";
                imgExpanded.style.transform = "scale(1)";
            }
            if (zoomIndicator) zoomIndicator.textContent = "1x";
        }
        function aplicarZoomControles() {
            if (imgExpanded) {
                imgExpanded.style.transformOrigin = "center center";
                imgExpanded.style.transform = `scale(${zoomLevel})`;
            }
            if (zoomIndicator) zoomIndicator.textContent = `${zoomLevel.toFixed(1)} x`;
        }
        if (zoomContainer) {
            zoomContainer.addEventListener("mousemove", (e) => {
                if (zoomLevel > 1.0) moverZoom(e.clientX, e.clientY);
            });
            zoomContainer.addEventListener("mouseleave", () => {
                if (!isZoomed) resetZoom();
            });
            zoomContainer.addEventListener("click", (e) => {
                isZoomed = !isZoomed;
                if (isZoomed) {
                    zoomLevel = 2.0;
                    moverZoom(e.clientX, e.clientY);
                } else {
                    resetZoom();
                }
            });
            zoomContainer.addEventListener("touchstart", (e) => {
                if (e.touches && e.touches.length === 1) {
                    const now = new Date().getTime();
                    const timesince = now - lastTap;
                    if ((timesince < 300) && (timesince > 0)) {
                        e.preventDefault();
                        isZoomed = !isZoomed;
                        if (isZoomed) {
                            zoomLevel = 2.0;
                            moverZoom(e.touches.clientX, e.touches.clientY);
                        } else {
                            resetZoom();
                        }
                    }
                    lastTap = now;
                }
            }, { passive: false });
            zoomContainer.addEventListener("touchmove", (e) => {
                if (zoomLevel > 1.0 && e.touches && e.touches.length === 1) {
                    e.preventDefault();
                    moverZoom(e.touches.clientX, e.touches.clientY);
                }
            }, { passive: false });
        }
        const zIn = document.getElementById("zoomIn");
        const zOut = document.getElementById("zoomOut");
        if (zIn) {
            zIn.addEventListener("click", (e) => {
                e.stopPropagation();
                zoomLevel = Math.min(zoomLevel + 0.5, 3.0);
                isZoomed = (zoomLevel > 1.0);
                aplicarZoomControles();
            });
        }
        if (zOut) {
            zOut.addEventListener("click", (e) => {
                e.stopPropagation();
                zoomLevel = Math.max(zoomLevel - 0.5, 1.0);
                if (zoomLevel === 1.0) {
                    resetZoom();
                } else {
                    aplicarZoomControles();
                }
            });
        }
        if (document.getElementById("nextBtn")) document.getElementById("nextBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            nextImagem();
        });
        if (document.getElementById("prevBtn")) document.getElementById("prevBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            prevImagem();
        });
        if (document.getElementById("closeBtn")) document.getElementById("closeBtn").addEventListener("click", closeModal);
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) closeModal();
            });
        }
        document.addEventListener("keydown", (e) => {
            if (modal && modal.style.display === "flex") {
                if (e.key === "Escape") closeModal();
                if (e.key === "ArrowRight") nextImagem();
                if (e.key === "ArrowLeft") prevImagem();
            }
        });
        document.addEventListener('contextmenu', (event) => event.preventDefault());
        document.addEventListener('dragstart', (event) => {
            if (event.target.tagName === 'IMG') event.preventDefault();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'F12' || (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'J' || event.key === 'C')) || (event.ctrlKey && event.key === 'u')) {
                event.preventDefault();
                return false;
            }
        });
        inicializarCatalogo();
    });
})();
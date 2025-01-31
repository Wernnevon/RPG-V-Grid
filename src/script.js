import { MESSAGE_TYPE } from "./enums/message-type.enum.js";
import { SOCKET_EVENTS } from "./enums/socket-event.enum.js";
import { sendMessage } from "./modules/websocket.js";

export const socket = new WebSocket("wss://arda-vtt-server.onrender.com");

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("rpgCanvas");
    const ctx = canvas.getContext("2d");
    let tileSize = 40; // Tamanho de cada célula do grid
    let gridWidth = 24;
    let gridHeight = 23;
    canvas.width = gridWidth * tileSize;
    canvas.height = gridHeight * tileSize;
    let tokens = [];
    let selectedToken = null;
    let isMovingToken = false;
    let initialTokenPosition = { x: -10, y: -10 }; // Posição inicial do token antes do movimento
    let tokenPosition = { x: 0, y: 0 };

    let isEditing = false; // Variável para indicar se estamos no modo de edição
    let editingToken = null; // Referência ao token que está sendo editado

    let backgroundImage = null; // Imagem de fundo do grid

    const contextMenu = document.getElementById("contextMenu");
    const editTokenOption = document.getElementById("editToken");
    const removeTokenOption = document.getElementById("removeToken");
    const minGridConfig = document.getElementById("containerMinimize");
    const formTokenSubmitButton = document.getElementById(
        "formTokenSubmitButton"
    );

    document.getElementById("main").addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });

    const inputBgImg = document.getElementById("gridBackground");
    const labelBgImg = document.getElementById("imageInputLabel");

    inputBgImg.addEventListener("change", function () {
        const fileName = this.files[0].name;
        labelBgImg.textContent = fileName;
    });

    const inputTokenImg = document.getElementById("tokenImage");
    const labelTokenImg = document.getElementById("tokenImgLabel");

    inputTokenImg.addEventListener("change", function () {
        const fileName = this.files[0].name;
        labelTokenImg.textContent = fileName;
    });

    minGridConfig.addEventListener("click", minimizeConfig);

    function minimizeConfig() {
        minGridConfig.classList.toggle("setting-toggle");
        const confGrid = document.getElementById("gridConfig");
        if (confGrid.style.width === "20px") {
            confGrid.style.width = "300px";
            confGrid.style.height = "auto";
        } else {
            confGrid.style.width = "20px";
            confGrid.style.height = "0px";
        }
    }

    // Função para desenhar o grid
    function drawGrid() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Desenhar imagem de fundo
        if (backgroundImage) {
            ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.beginPath();
        ctx.strokeStyle = "grey";

        // Desenhar linhas verticais
        for (let x = 0; x <= canvas.width; x += tileSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }

        // Desenhar linhas horizontais
        for (let y = 0; y <= canvas.height; y += tileSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }

        ctx.stroke();
        ctx.closePath();
    }

    // Função para desenhar os tokens com imagem e bordas aleatórias
    function drawTokens() {
        tokens.forEach((token) => {
            const tokenX = token.x * tileSize + tileSize / 2;
            const tokenY = token.y * tileSize + tileSize / 2;
            const tokenRadius = tileSize / 2 - 5;

            // Desenhar a borda
            ctx.beginPath();
            ctx.arc(tokenX, tokenY, tokenRadius, 0, Math.PI * 2);
            ctx.fillStyle = token.color;
            ctx.fill();
            ctx.closePath();

            // Desenhar o círculo interno com a imagem
            ctx.beginPath();
            ctx.arc(tokenX, tokenY, tokenRadius - 2, 0, Math.PI * 2);

            // Clipping para aplicar a imagem dentro do círculo
            ctx.save();
            ctx.clip();

            // Desenhar a imagem dentro do círculo
            if (token.image) {
                ctx.drawImage(
                    token.image,
                    tokenX - tokenRadius + 2,
                    tokenY - tokenRadius + 2,
                    tokenRadius * 2 - 4,
                    tokenRadius * 2 - 4
                );
            }

            // Restaurar o contexto para limpar o clipping
            ctx.restore();
            ctx.closePath();
        });
    }

    // Função para desenhar a área de movimento do token
    function drawMovementArea(token) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(0, 255, 0, 0.3)"; // Verde com transparência
        const startX = Math.max(
            initialTokenPosition.x - token.movementRange,
            0
        );
        const endX = Math.min(
            initialTokenPosition.x + token.movementRange,
            Math.round(canvas.width / tileSize) - 1
        );
        const startY = Math.max(
            initialTokenPosition.y - token.movementRange,
            0
        );
        const endY = Math.min(
            initialTokenPosition.y + token.movementRange,
            Math.round(canvas.height / tileSize) - 1
        );

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }
        ctx.closePath();
    }

    // Função para adicionar um token
    function addToken(gridX, gridY, name, movementRange, image) {
        if (isEditing && editingToken) {
            // Atualiza o token existente
            editingToken.name = name;
            editingToken.movementRange = movementRange;
            editingToken.image = image || editingToken.image;
            isEditing = false;
            editingToken = null;
        } else {
            // Cria um novo token
            const token = {
                x: gridX,
                y: gridY,
                initialX: gridX,
                initialY: gridY,
                color: "#" + Math.floor(Math.random() * 16777215).toString(16), // Cor aleatória
                name: name || "Token " + (tokens.length + 1),
                movementRange: movementRange || 1,
                image: image || null,
                id: crypto.randomUUID(),
            };
            tokens.push(token);
        }
        redraw();
    }

    // Função para encontrar o token clicado
    function findToken(x, y) {
        const gridX = Math.floor(x / tileSize);
        const gridY = Math.floor(y / tileSize);
        return tokens.find((token) => token.x === gridX && token.y === gridY);
    }

    let offsetX = 0; // Offset para o scroll horizontal
    let offsetY = 0; // Offset para o scroll vertical
    let isDraggingCanvas = false;
    let startDragOffset = { x: 0, y: 0 };

    // Evento de clique para adicionar/mover/remover tokens
    canvas.addEventListener("mousedown", handleCanvasMouseDown);

    function handleCanvasMouseDown(event) {
        closeMenuOrForm();
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const clickedToken = findToken(x, y);
        if (clickedToken) {
            selectedToken = clickedToken;
            if (event.button === 2) {
                showContextMenu(event.pageX, event.pageY);
            } else {
                selectedToken = clickedToken;
                isMovingToken = true;
                initialTokenPosition = {
                    x: selectedToken.x,
                    y: selectedToken.y,
                };
                redraw();
            }
        } else {
            if (event.button !== 2) {
                // Ativa o scroll
                isDraggingCanvas = true;
                startDragOffset = { x: x + offsetX, y: y + offsetY };
            } else {
                // Mostra o formulário próximo ao token clicado
                showForm(event.pageX, event.pageY);
                tokenPosition.x = Math.floor(x / tileSize);
                tokenPosition.y = Math.floor(y / tileSize);
            }
        }
    }

    // Evento de movimento do mouse
    canvas.addEventListener("mousemove", handleCanvasMouseMove);

    function handleCanvasMouseMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (isMovingToken && selectedToken) {
            const gridX = Math.floor(x / tileSize);
            const gridY = Math.floor(y / tileSize);
            if (
                Math.abs(gridX - initialTokenPosition.x) <=
                    selectedToken.movementRange &&
                Math.abs(gridY - initialTokenPosition.y) <=
                    selectedToken.movementRange
            ) {
                selectedToken.x = gridX;
                selectedToken.y = gridY;
            }
            // Quando o token for movido ou criado, envie uma atualização
            const updatedToken = {
                id: selectedToken.id,
                x: selectedToken.x,
                y: selectedToken.y,
            };

            sendMessage(MESSAGE_TYPE.TOKEN, updatedToken);
            redraw();
        } else if (isDraggingCanvas) {
            const scrollToX = startDragOffset.x - x;
            const scrollToY = startDragOffset.y - y;

            offsetX =
                scrollToX < 0
                    ? 0
                    : scrollToX > document.body.scrollWidth
                    ? document.body.scrollWidth
                    : scrollToX;
            offsetY =
                scrollToY < 0
                    ? 0
                    : scrollToY > document.body.scrollHeight
                    ? document.body.scrollHeight
                    : scrollToY;
            window.scrollTo({
                left: offsetX * 2,
                top: offsetY * 2,
                behavior: "smooth",
            });
            // redraw();
        }

        const hoveredToken = findToken(x, y); // Verifica se há um token no local do cursor
        redraw(); // Redesenha o canvas para limpar nomes antigos

        if (hoveredToken) {
            displayTokenName(hoveredToken);
        }
    }

    // Função para exibir o nome do token centralizado
    function displayTokenName(token) {
        const text = token.name;
        const padding = 10;
        const borderRadius = 8;

        ctx.font = "16px Arial";
        const textWidth = ctx.measureText(text).width;
        const textHeight = 16;

        // Posição central do token
        const tokenX = token.x * tileSize + tileSize / 2;
        const tokenY = token.y * tileSize;

        // Largura e altura do tooltip
        const rectWidth = textWidth + padding * 2;
        const rectHeight = textHeight + padding * 2;

        // Posição X/Y ajustada para centralização
        const tooltipX = tokenX - rectWidth / 2;
        const tooltipY = tokenY - rectHeight - 10; // 10px acima do token

        // Desenha o fundo
        ctx.beginPath();
        drawRoundedRect(
            ctx,
            tooltipX,
            tooltipY,
            rectWidth,
            rectHeight,
            borderRadius
        );
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fill();

        // Texto centralizado
        ctx.fillStyle = "white";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillText(
            text,
            tokenX, // Centraliza horizontalmente
            tooltipY + rectHeight / 2 // Centraliza verticalmente
        );
    }

    // Função para desenhar um retângulo com bordas arredondadas
    function drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius,
            y + height
        );
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    // Evento de soltar o mouse
    canvas.addEventListener("mouseup", handleCanvasMouseUp);

    function handleCanvasMouseUp() {
        isMovingToken = false;
        isDraggingCanvas = false;
        redraw();
    }

    // Função para mostrar o formulário de criação de token
    function showForm(x, y) {
        const form = document.getElementById("tokenForm");

        form.style.left = `${x + tileSize / 1.5}px`;
        form.style.top = `${y}px`;

        closeMenuOrForm();
        form.style.display = "flex";
    }

    // Evento para adicionar token através do formulário
    formTokenSubmitButton.addEventListener("click", handleSaveToken);

    function handleSaveToken() {
        const tokenName = document.getElementById("tokenName").value.trim();
        const movementRange = parseInt(
            document.getElementById("movementRange").value.trim(),
            10
        );
        const [tokenImage] = document.getElementById("tokenImage").files;

        if (tokenName && movementRange >= 1) {
            if (tokenImage) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const image = new Image();
                    image.src = event.target.result;
                    image.onload = function () {
                        addToken(
                            tokenPosition.x,
                            tokenPosition.y,
                            tokenName,
                            movementRange,
                            image
                        );
                        sendMessage(MESSAGE_TYPE.TOKEN, {
                            ...tokens.at(-1),
                            image: event.target.result,
                        });
                        resetForm();
                    };
                };
                reader.readAsDataURL(tokenImage);
            } else {
                addToken(
                    tokenPosition.x,
                    tokenPosition.y,
                    tokenName,
                    movementRange
                );
                sendMessage(MESSAGE_TYPE.TOKEN, tokens.at(-1));
                resetForm();
            }
        } else {
            alert("Preencha todos os campos corretamente.");
        }
    }

    // Função para esconder o formulário de token
    function hideTokenForm() {
        const tokenForm = document.getElementById("tokenForm");
        tokenForm.style.display = "none";
    }

    // Evento para fechar o formulário
    document
        .getElementById("close-btn")
        .addEventListener("click", closeMenuOrForm);

    // Função para fechar menu de contexto ou formulário
    function closeMenuOrForm() {
        const form = document.getElementById("tokenForm");
        const contextMenu = document.getElementById("contextMenu");

        if (form.style.display === "flex") hideTokenForm();
        if (contextMenu.style.display === "block")
            contextMenu.style.display = "none";
    }

    // Função para resetar o formulário de token
    function resetForm() {
        tokenPosition.x = 0;
        tokenPosition.y = 0;
        document.getElementById("tokenName").value = "John Doe";
        document.getElementById("movementRange").value = "7";
        document.getElementById("tokenImage").value = "";
        document.getElementById("tokenImgLabel").innerHTML =
            "Escolha uma imagem do token...";
        hideTokenForm();
    }

    // Função para redesenhar o canvas
    function redraw() {
        drawGrid();
        drawTokens();
        tokens.forEach((token) => {
            if (token === selectedToken && isMovingToken)
                drawMovementArea(token);
        });
    }

    // Função para mostrar o menu de contexto
    function showContextMenu(x, y) {
        contextMenu.style.left = `${x + tileSize / 2}px`;
        contextMenu.style.top = `${y - tileSize / 2}px`;
        contextMenu.style.display = "block";
    }

    // Função para editar o token
    function editToken() {
        const form = document.getElementById("tokenForm");
        form.style.left = `${contextMenu.style.left}`;
        form.style.top = `${contextMenu.style.top}`;
        document.getElementById("tokenName").value = selectedToken.name;
        document.getElementById("movementRange").value =
            selectedToken.movementRange;
        isEditing = true;
        editingToken = selectedToken;
        form.style.display = "flex";
        contextMenu.style.display = "none";
    }

    // Função para remover o token
    function removeToken() {
        const index = tokens.map(({ id }) => id).indexOf(selectedToken.id);
        if (index > -1) {
            tokens.splice(index, 1);
            sendMessage(MESSAGE_TYPE.REMOVE_TOKEN, index);
        }
        selectedToken = null;
        contextMenu.style.display = "none";
        redraw();
    }

    // Eventos para opções do menu de contexto
    editTokenOption.addEventListener("click", editToken);
    removeTokenOption.addEventListener("click", removeToken);

    function getDimensions() {
        tileSize = parseInt(document.getElementById("gridSize").value, 10);
        gridWidth = parseInt(document.getElementById("gridWidth").value, 10);
        gridHeight = parseInt(document.getElementById("gridHeight").value, 10);
    }

    // Evento para aplicar configurações do grid
    document
        .getElementById("applyGridSettings")
        .addEventListener("click", function () {
            getDimensions();
            canvas.height = gridHeight * tileSize;
            canvas.width = gridWidth * tileSize;
            const bgImageInput = document.getElementById("gridBackground");

            // Verifica se há uma imagem de fundo selecionada
            if (bgImageInput && bgImageInput.files.length > 0) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    backgroundImage = new Image();
                    backgroundImage.src = event.target.result;
                    backgroundImage.onload = function () {
                        sendMessage(MESSAGE_TYPE.GRID, {
                            gridSize: tileSize,
                            gridWidth,
                            gridHeight,
                            backgroundImage: event.target.result,
                        });
                        redraw();
                    };
                };
                reader.readAsDataURL(bgImageInput.files[0]);
                minimizeConfig();
            } else {
                sendMessage(MESSAGE_TYPE.GRID, {
                    gridSize: tileSize,
                    gridWidth,
                    gridHeight,
                    backgroundImage: null,
                });
                redraw();
            }
        });

    // Inicializa o canvas
    redraw();

    document.addEventListener("mousewheel", handleDisbleWheel, {
        passive: false,
    });

    document.addEventListener("DOMMouseScroll", handleDisbleWheel, {
        passive: false,
    });

    function handleDisbleWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    // Definir uma imagem de fundo padrão
    const defaultBackgroundImage = new Image();
    defaultBackgroundImage.onload = function () {
        backgroundImage = defaultBackgroundImage;
        redraw();
    };
    defaultBackgroundImage.src = "src/assets/defaultBackground.jpeg";

    // Quando a conexão for aberta
    socket.addEventListener(SOCKET_EVENTS.OPEN, () => {
        console.log("Conectado ao servidor WebSocket.");
    });

    // Quando receber uma mensagem do servidor
    socket.addEventListener(SOCKET_EVENTS.MESSAGE, processMessage);

    function processMessage({ data: dataMessage }) {
        if (dataMessage) {
            const { type, data, message } = JSON.parse(dataMessage);
            const startegyProcess = {
                [MESSAGE_TYPE.WELCOME]: () => {
                    console.log(message);
                },
                [MESSAGE_TYPE.TOKEN]: () => {
                    updateToken(data);
                },
                [MESSAGE_TYPE.REMOVE_TOKEN]: () => {
                    deleteToken(data);
                },
                [MESSAGE_TYPE.GRID]: () => {
                    updateGrid(data);
                },
            };
            startegyProcess[type]();
        }
    }

    function updateGrid(gridConfig) {
        console.log("grid", gridConfig);
        tileSize = gridConfig.gridSize;
        canvas.width = gridConfig.gridWidth * tileSize;
        canvas.height = gridConfig.gridHeight * tileSize;
        document.getElementById("gridSize").value = gridConfig.gridSize;
        document.getElementById("gridWidth").value = gridConfig.gridWidth;
        document.getElementById("gridHeight").value = gridConfig.gridHeight;
        if (gridConfig.backgroundImage) {
            console.log();
            loadBackground(gridConfig.backgroundImage);
        } else {
            redraw();
        }
    }

    function loadBackground(gridImage) {
        if (gridImage !== backgroundImage.src) {
            const img = new Image();
            img.src = gridImage; // Atualiza a imagem de fundo para todos
            img.onload = function () {
                backgroundImage = img;
                bgImageInput.files.length = 0;
                redraw();
            };
        } else {
            redraw();
        }
    }

    function updateToken(token) {
        if (token.image) {
            loadTokenImage(token);
            return;
        }

        const existingToken = tokens.find((t) => t.id === token.id);
        if (existingToken) {
            // Atualiza a posição do token recebido
            existingToken.x = token.x;
            existingToken.y = token.y;
        } else {
            tokens.push(token);
        }
        redraw();
    }

    function loadTokenImage(token) {
        const existingToken = tokens.find((t) => t.id === token.id);
        const tokenToSave = token;
        const img = new Image();
        img.src = token.image;

        if (existingToken) {
            img.onload = function () {
                existingToken.image = img;
                redraw();
            };
            return;
        }
        img.onload = function () {
            tokenToSave.image = img;
            tokens.push(tokenToSave);
            redraw();
        };
    }

    function deleteToken(tokenIndex) {
        tokens.splice(tokenIndex, 1);
        redraw();
    }

    // Evento para limpar o grid
    document.getElementById("clearGrid").addEventListener("click", () => {
        tokens = [];
        redraw();
    });
});

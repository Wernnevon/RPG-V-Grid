document.addEventListener("DOMContentLoaded", () => {
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

  const canvas = document.getElementById("rpgCanvas");
  const ctx = canvas.getContext("2d");
  let gridSize = 80; // Tamanho de cada célula do grid
  canvas.width = 50 * gridSize;
  canvas.height = 50 * gridSize;
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
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }

    // Desenhar linhas horizontais
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }

    ctx.stroke();
    ctx.closePath();
  }

  // Função para desenhar os tokens com imagem e bordas aleatórias
  function drawTokens() {
    tokens.forEach((token) => {
      const tokenX = token.x * gridSize + gridSize / 2;
      const tokenY = token.y * gridSize + gridSize / 2;
      const tokenRadius = gridSize / 2 - 5;

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
    const startX = Math.max(initialTokenPosition.x - token.movementRange, 0);
    const endX = Math.min(
      initialTokenPosition.x + token.movementRange,
      canvas.width / gridSize - 1
    );
    const startY = Math.max(initialTokenPosition.y - token.movementRange, 0);
    const endY = Math.min(
      initialTokenPosition.y + token.movementRange,
      canvas.height / gridSize - 1
    );

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
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
      };
      tokens.push(token);
    }
    redraw();
  }

  // Função para encontrar o token clicado
  function findToken(x, y) {
    const gridX = Math.floor(x / gridSize);
    const gridY = Math.floor(y / gridSize);
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
        initialTokenPosition = { x: selectedToken.x, y: selectedToken.y };
        redraw(selectedToken);
      }
    } else {
      if (event.button !== 2) {
        // Ativa o scroll
        isDraggingCanvas = true;
        startDragOffset = { x: x + offsetX, y: y + offsetY };
      } else {
        // Mostra o formulário próximo ao token clicado
        showForm(event.pageX, event.pageY);
        tokenPosition.x = Math.floor(x / gridSize);
        tokenPosition.y = Math.floor(y / gridSize);
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
      const gridX = Math.floor(x / gridSize);
      const gridY = Math.floor(y / gridSize);
      if (
        Math.abs(gridX - initialTokenPosition.x) <=
          selectedToken.movementRange &&
        Math.abs(gridY - initialTokenPosition.y) <= selectedToken.movementRange
      ) {
        selectedToken.x = gridX;
        selectedToken.y = gridY;
      }
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
        left: offsetX,
        top: offsetY,
        behavior: "smooth",
      });
      redraw();
    }
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

    form.style.left = `${x + gridSize / 1.5}px`;
    form.style.top = `${y}px`;

    closeMenuOrForm();
    form.style.display = "block";
  }

  // Evento para adicionar token através do formulário
  document
    .getElementById("addTokenBtn")
    .addEventListener("click", handleAddToken);

  function handleAddToken() {
    const tokenName = document.getElementById("tokenName").value.trim();
    const movementRange = parseInt(
      document.getElementById("movementRange").value.trim(),
      10
    );
    const tokenImage = document.getElementById("tokenImage").files[0];

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
            resetForm();
          };
        };
        reader.readAsDataURL(tokenImage);
      } else {
        addToken(tokenPosition.x, tokenPosition.y, tokenName, movementRange);
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

    if (form.style.display === "block") hideTokenForm();
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
    hideTokenForm();
  }

  // Função para redesenhar o canvas
  function redraw() {
    drawGrid();
    drawTokens();
    tokens.forEach((token) => {
      if (token === selectedToken && isMovingToken) drawMovementArea(token);
    });
  }

  // Função para mostrar o menu de contexto
  function showContextMenu(x, y) {
    contextMenu.style.left = `${x + gridSize / 2}px`;
    contextMenu.style.top = `${y - gridSize / 2}px`;
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
    form.style.display = "block";
    contextMenu.style.display = "none";
  }

  // Função para remover o token
  function removeToken() {
    const index = tokens.indexOf(selectedToken);
    if (index > -1) {
      tokens.splice(index, 1);
    }
    selectedToken = null;
    contextMenu.style.display = "none";
    redraw();
  }

  // Eventos para opções do menu de contexto
  editTokenOption.addEventListener("click", editToken);
  removeTokenOption.addEventListener("click", removeToken);

  // Evento para aplicar configurações do grid
  document
    .getElementById("applyGridSettings")
    .addEventListener("click", function () {
      canvas.width =
        parseInt(document.getElementById("gridWidth").value, 10) * gridSize;
      canvas.height =
        parseInt(document.getElementById("gridHeight").value, 10) * gridSize;
      const bgImageInput = document.getElementById("gridBackground");

      // Verifica se há uma imagem de fundo selecionada
      if (bgImageInput && bgImageInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function (event) {
          backgroundImage = new Image();
          backgroundImage.src = event.target.result;
          backgroundImage.onload = function () {
            redraw();
          };
        };
        reader.readAsDataURL(bgImageInput.files[0]);
        minimizeConfig();
      } else {
        backgroundImage = null;
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
});

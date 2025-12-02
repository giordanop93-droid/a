document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // Configurações gerais
  // ============================
  const WEBHOOK_URL =
    "https://dinastia-n8n-webhook.0xpkr4.easypanel.host/webhook/sageveea";
  const QUIZ_CODE_KEY = "veea_quiz_code";

  // Gera ou recupera o código único da sessão do quiz
  function getOrCreateQuizCode() {
    let code = sessionStorage.getItem(QUIZ_CODE_KEY);

    if (!code) {
      const ts = Date.now().toString(36);
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      code = `VEEA-${ts}-${rand}`;
      sessionStorage.setItem(QUIZ_CODE_KEY, code);
    }

    return code;
  }

  // Envia qualquer payload para o webhook
  function sendToWebhook(payload) {
    try {
      return fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.error("Erro ao enviar dados para o webhook:", err);
      });
    } catch (err) {
      console.error("Erro inesperado ao tentar enviar para o webhook:", err);
      // Garante que o restante do fluxo continue mesmo com erro
      return Promise.resolve();
    }
  }

  // Nome do arquivo da página atual (ex.: index.html, step1.html, oferta.html)
  const pageName =
    window.location.pathname.split("/").pop() || "index.html";

  // ============================
  // Botão da tela inicial (index.html)
  // ============================
  const startBtn = document.getElementById("startBtn");

  if (startBtn) {
    const nextPage = startBtn.dataset.nextPage || "step1.html";

    startBtn.addEventListener("click", (event) => {
      event.preventDefault();

      const payload = {
        code: getOrCreateQuizCode(),
        event: "start_quiz",
        question: null,
        answer: null,
        step: "intro",
        page: pageName,
        timestamp: new Date().toISOString(),
      };

      const sendPromise = sendToWebhook(payload);

      // Espera o envio começar e só depois navega
      sendPromise.finally(() => {
        setTimeout(() => {
          window.location.href = nextPage;
        }, 260);
      });
    });
  }

  // ============================
  // Página de oferta (oferta.html)
  // ============================
  if (pageName === "oferta.html") {
    // Qualquer botão/link da oferta que tiver data-offer="alguma-coisa"
    const offerElements = document.querySelectorAll("[data-offer]");

    offerElements.forEach((el) => {
      el.addEventListener("click", (event) => {
        const href = el.getAttribute("href");

        if (href) {
          // Controla a navegação pra garantir que o webhook dispare
          event.preventDefault();
        }

        const payload = {
          code: getOrCreateQuizCode(),
          event: "offer_click",
          offer: el.getAttribute("data-offer") || null,
          label: el.innerText.trim(),
          page: pageName,
          timestamp: new Date().toISOString(),
        };

        const sendPromise = sendToWebhook(payload);

        // Depois de enviar, redireciona pro checkout (Kiwify)
        if (href) {
          sendPromise.finally(() => {
            window.location.href = href;
          });
        }
      });
    });

    // Página de oferta não é etapa do quiz – encerra aqui
    return;
  }

  // ============================
  // Páginas de etapa do quiz (step1.html ... step6.html)
  // ============================
  const optionsContainer = document.querySelector(".quiz-options");
  if (!optionsContainer) {
    // Se não existe bloco de opções, não é página de etapa de quiz
    return;
  }

  const optionButtons = optionsContainer.querySelectorAll(".option");
  const nextPage = document.body.dataset.nextPage;

  const questionEl = document.querySelector(".quiz-question");
  const stepEl = document.querySelector(".quiz-step");
  const textInput = document.querySelector(".quiz-text-input");

  const questionText = questionEl ? questionEl.innerText.trim() : "";
  const stepText = stepEl ? stepEl.innerText.trim() : "";

  // Caso especial: etapa do nome da marca (tem campo de texto e um único botão AVANÇAR)
  if (textInput && optionButtons.length === 1) {
    const advanceBtn = optionButtons[0];

    // Estado inicial: desabilitar se estiver vazio
    const toggleAdvanceDisabled = () => {
      const empty = textInput.value.trim() === "";
      advanceBtn.disabled = empty;
    };

    toggleAdvanceDisabled();

    textInput.addEventListener("input", () => {
      toggleAdvanceDisabled();
    });

    // Se apertar ENTER dentro do campo, simula clique no botão
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        advanceBtn.click();
      }
    });
  }

  // Listener de clique para todas as opções (inclusive o AVANÇAR da etapa de texto)
  optionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove seleção anterior e aplica na atual (efeito visual)
      optionButtons.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      let answerText = "";

      // Etapa com input de texto (nome da marca)
      if (textInput) {
        answerText = textInput.value.trim();

        // Bloqueio extra de segurança: se estiver vazio, NÃO avança nem envia
        if (!answerText) {
          alert("Por favor, preencha o nome da sua marca antes de continuar.");
          textInput.focus();
          return;
        }
      } else {
        // Etapas com botões de opção
        const labelEl = btn.querySelector(".option-label");
        answerText = labelEl
          ? labelEl.innerText.trim()
          : btn.innerText.trim();
      }

      const payload = {
        code: getOrCreateQuizCode(), // código único da sessão
        event: "answer",             // evento de resposta de pergunta
        question: questionText || null,
        answer: answerText,
        step: stepText || null,      // ex: "Etapa 3 de 6"
        page: pageName,
        timestamp: new Date().toISOString(),
      };

      const sendPromise = sendToWebhook(payload);

      // Depois de enviar, se houver próxima página, navega
      if (nextPage) {
        sendPromise.finally(() => {
          setTimeout(() => {
            window.location.href = nextPage;
          }, 260);
        });
      }
    });
  });
});

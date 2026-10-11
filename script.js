document.addEventListener("DOMContentLoaded", () => {
  // ELEMENTS
  const plantImage = document.getElementById("plantImage");
  const imagePreview = document.getElementById("imagePreview");
  const identifyButton = document.getElementById("identifyButton");
  const predictionResult = document.getElementById("predictionResult");

  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");

  let selectedFile = null;
  let previewUrl = null;
  let requestInProgress = false;

  // FORMAT AI ANSWERS AS SAFE HTML
  function renderAnswer(element, text) {
    const answer = text || "No answer returned.";

    if (
      window.marked &&
      window.DOMPurify &&
      typeof window.marked.parse === "function"
    ) {
      const html = window.marked.parse(answer);
      element.innerHTML = window.DOMPurify.sanitize(html);
    } else {
      element.textContent = answer;
      console.warn(
        "Markdown formatting unavailable. Check the script tags in index.html."
      );
    }
  }

  // PLANT IMAGE PREVIEW
  if (plantImage && imagePreview) {
    plantImage.addEventListener("change", () => {
      selectedFile = plantImage.files?.[0] || null;

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }

      imagePreview.replaceChildren();

      if (!selectedFile) return;

      if (!selectedFile.type.startsWith("image/")) {
        alert("Please select an image file.");
        plantImage.value = "";
        selectedFile = null;
        return;
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        alert("Please select an image smaller than 10 MB.");
        plantImage.value = "";
        selectedFile = null;
        return;
      }

      previewUrl = URL.createObjectURL(selectedFile);

      const img = document.createElement("img");
      img.src = previewUrl;
      img.alt = "Selected plant";
      imagePreview.appendChild(img);

      if (predictionResult) {
        predictionResult.textContent =
          "Image ready. Click Identify Plant.";
      }
    });
  }

  // IDENTIFY PLANT
  if (identifyButton) {
    identifyButton.addEventListener("click", async () => {
      if (!selectedFile) {
        alert("Please select a plant image first.");
        return;
      }

      identifyButton.disabled = true;
      identifyButton.textContent = "Analyzing...";

      if (predictionResult) {
        predictionResult.textContent =
          "Garuna is analyzing the plant image...";
      }

      try {
        const formData = new FormData();
        formData.append("plantImage", selectedFile);

        const response = await fetch("/api/identify", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Identification failed.");
        }

        if (predictionResult) {
          renderAnswer(predictionResult, data.result);
        }
      } catch (error) {
        console.error("Plant identification error:", error);

        if (predictionResult) {
          predictionResult.textContent =
            "Could not identify the plant. " +
            (error.message || "Please try again.");
        }
      } finally {
        identifyButton.disabled = false;
        identifyButton.textContent = "Identify Plant";
      }
    });
  }

  // DISPLAY CHAT MESSAGES
  function addMessage(text, sender) {
    const message = document.createElement("div");

    // These classes match the CSS styles.
    message.className =
      sender === "assistant"
        ? "chat-bubble bot-message"
        : "chat-bubble user-message";

    if (sender === "assistant") {
      renderAnswer(message, text);
    } else {
      message.textContent = text;
    }

    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return message;
  }

  // ASK GARUNA
  async function askGaruna(question) {
    const cleanQuestion = String(question || "").trim();

    if (!cleanQuestion || requestInProgress || !chatMessages) {
      return;
    }

    requestInProgress = true;

    addMessage(cleanQuestion, "user");

    if (chatInput) {
      chatInput.value = "";
    }

    const loadingMessage = addMessage("Thinking...", "assistant");

    const suggestionButtons =
      document.querySelectorAll("[data-question]");

    const submitButton = chatForm?.querySelector(
      'button[type="submit"], button:not([type])'
    );

    suggestionButtons.forEach((button) => {
      button.disabled = true;
    });

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: cleanQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed.");
      }

      renderAnswer(
        loadingMessage,
        data.reply || "No answer returned. Please try again."
      );
    } catch (error) {
      console.error("Garuna chat error:", error);

      loadingMessage.textContent =
        "Garuna couldn't answer right now. Please try again.";
    } finally {
      requestInProgress = false;

      suggestionButtons.forEach((button) => {
        button.disabled = false;
      });

      if (submitButton) {
        submitButton.disabled = false;
      }

      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // CHAT FORM SUBMISSION
  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      askGaruna(chatInput.value);
    });
  }

  // CLICKABLE SUGGESTED QUESTIONS
  document.querySelectorAll("[data-question]").forEach((button) => {
    button.setAttribute("title", "Ask Garuna this question");

    button.addEventListener("click", () => {
      askGaruna(button.dataset.question || button.textContent);
    });
  });

  // PLANT LIBRARY SEARCH AND FILTER
  const plantSearch = document.getElementById("plantSearch");

  const plantCards = document.querySelectorAll(
    ".plant-card, [data-name][data-category]"
  );

  const noPlants = document.getElementById("noPlants");

  const filterButtons =
    document.querySelectorAll("[data-filter]");

  let activeFilter = "All";

  function filterPlants() {
    const searchText = (plantSearch?.value || "")
      .trim()
      .toLowerCase();

    let visibleCount = 0;

    plantCards.forEach((card) => {
      const name = (
        card.dataset.name || card.textContent || ""
      ).toLowerCase();

      const category = card.dataset.category || "Other";

      const matchesSearch = name.includes(searchText);

      const matchesFilter =
        activeFilter === "All" ||
        category.toLowerCase() === activeFilter.toLowerCase();

      const visible = matchesSearch && matchesFilter;

      card.hidden = !visible;

      if (visible) {
        visibleCount++;
      }
    });

    if (noPlants) {
      noPlants.hidden = visibleCount !== 0;
    }
  }

  if (plantSearch) {
    plantSearch.addEventListener("input", filterPlants);
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "All";

      filterButtons.forEach((item) => {
        item.classList.toggle("active", item === button);

        item.setAttribute(
          "aria-pressed",
          String(item === button)
        );
      });

      filterPlants();
    });
  });

  // PLANT DETAILS BUTTONS
  document.querySelectorAll("[data-details]").forEach((button) => {
    button.addEventListener("click", () => {
      const plantName =
        button.dataset.details ||
        button.closest("[data-name]")?.dataset.name;

      if (plantName && chatInput) {
        chatInput.value =
          `Tell me about ${plantName}: scientific name, habitat, ` +
          "identifying features, and traditional uses.";

        chatInput.focus();

        chatInput.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    });
  });

  // SAMPLE PLANT BUTTONS
  document.querySelectorAll("[data-plant]").forEach((button) => {
    button.addEventListener("click", () => {
      const plantName = button.dataset.plant;

      if (plantName && chatInput) {
        chatInput.value =
          `Tell me about ${plantName}, including its scientific name and habitat.`;

        chatInput.focus();

        chatInput.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    });
  });
});
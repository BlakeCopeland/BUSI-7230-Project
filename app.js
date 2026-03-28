const DAILY_DOUBLE_FALLBACK_LIMIT = 1000;

const state = {
  spec: null,
  teamNames: ["Team 1", "Team 2"],
  teams: [0, 0],
  roundOrder: [],
  currentRoundIndex: 0,
  usedCluesByRound: {},
  dailyDoubleAssignments: {},
  activeClue: null,
  activeValue: 0,
  finalAnswered: false,
  clueScoreAdjustments: ["none", "none"],
  gameStarted: false,
};

const boardElement = document.getElementById("board");
const titleElement = document.getElementById("game-title");
const descriptionElement = document.getElementById("game-description");
const roundIndicatorElement = document.getElementById("round-indicator");
const statusTextElement = document.getElementById("status-text");
const primaryActionButton = document.getElementById("start-final");
const clueModal = document.getElementById("clue-modal");
const finalModal = document.getElementById("final-modal");
const startModal = document.getElementById("start-modal");
const boardCellTemplate = document.getElementById("board-cell-template");

const modalCategoryElement = document.getElementById("modal-category");
const modalTitleElement = document.getElementById("modal-title");
const modalPromptElement = document.getElementById("modal-prompt");
const modalChoicesElement = document.getElementById("modal-choices");
const modalFeedbackElement = document.getElementById("modal-feedback");
const modalScoringElement = document.getElementById("modal-scoring");
const continueClueButton = document.getElementById("continue-clue");
const scoringSummaryElement = document.getElementById("scoring-summary");

const dailyDoubleSetupElement = document.getElementById("daily-double-setup");
const clueQuestionBlockElement = document.getElementById("clue-question-block");
const dailyDoubleTeamSelect = document.getElementById("daily-double-team");
const dailyDoubleWagerInput = document.getElementById("daily-double-wager");
const dailyDoubleLimitElement = document.getElementById("daily-double-limit");
const startDailyDoubleButton = document.getElementById("start-daily-double");

const teamNameElements = [
  document.getElementById("team-1-name"),
  document.getElementById("team-2-name"),
];
const scoreAdjustNameElements = [
  document.getElementById("score-adjust-name-0"),
  document.getElementById("score-adjust-name-1"),
];
const dailyDoubleOptionElements = [
  document.getElementById("daily-double-option-0"),
  document.getElementById("daily-double-option-1"),
];
const finalWagerLabelElements = [
  document.getElementById("final-wager-label-1"),
  document.getElementById("final-wager-label-2"),
];
const finalCorrectButtons = [
  document.getElementById("final-team-0-button"),
  document.getElementById("final-team-1-button"),
];

document.getElementById("reset-game").addEventListener("click", resetGame);
document.getElementById("close-modal").addEventListener("click", closeClueModal);
document.getElementById("close-final-modal").addEventListener("click", () => finalModal.close());
document.getElementById("start-game").addEventListener("click", startGame);
primaryActionButton.addEventListener("click", handlePrimaryAction);
continueClueButton.addEventListener("click", handleClueContinue);
startDailyDoubleButton.addEventListener("click", startDailyDoubleRound);
dailyDoubleTeamSelect.addEventListener("change", updateDailyDoubleLimit);

document.querySelectorAll("[data-team-adjust-select]").forEach((button) => {
  button.addEventListener("click", () => {
    const teamIndex = Number(button.dataset.teamAdjustSelect);
    state.clueScoreAdjustments[teamIndex] = button.dataset.mode;
    syncScoringSelection();
  });
});

document.querySelectorAll("[data-final-team]").forEach((button) => {
  button.addEventListener("click", () => {
    applyFinalJeopardy(button.dataset.finalTeam);
  });
});

async function init() {
  try {
    const response = await fetch("./accounting_jeopardy_game_spec.json");
    if (!response.ok) {
      throw new Error("Unable to load the JSON spec.");
    }

    state.spec = await response.json();
    initializeGame();
  } catch (error) {
    statusTextElement.textContent = `${error.message} If you opened the page directly, run it through a local web server so the browser can fetch the spec file.`;
  }
}

function initializeGame() {
  const { project } = state.spec;
  titleElement.textContent = project.title;
  descriptionElement.textContent = project.description;
  state.roundOrder = Object.keys(state.spec)
    .filter((key) => /^round_\d+$/.test(key))
    .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]));

  buildFreshGameState();
  applyTeamNames();
  renderBoard();
  updateScoreDisplay();
  updateRoundIndicator();
  updateStatus();
  syncStartInputs();
  startModal.showModal();
}

function buildFreshGameState() {
  state.currentRoundIndex = 0;
  state.usedCluesByRound = {};
  state.dailyDoubleAssignments = {};
  state.activeClue = null;
  state.activeValue = 0;
  state.finalAnswered = false;
  state.clueScoreAdjustments = ["none", "none"];

  state.roundOrder.forEach((roundKey) => {
    state.usedCluesByRound[roundKey] = new Set();
    state.dailyDoubleAssignments[roundKey] = randomizeDailyDoublesForRound(roundKey);
  });
}

function randomizeDailyDoublesForRound(roundKey) {
  const round = state.spec[roundKey];
  const categories = round.categories;
  const availableKeys = [];

  for (let rowIndex = 0; rowIndex < categories[0].clues.length; rowIndex += 1) {
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
      availableKeys.push(`${categoryIndex}-${rowIndex}`);
    }
  }

  const shuffledKeys = shuffleArray(availableKeys);
  const assignments = {};
  const dailyDoubleContent = getDailyDoublePool(roundKey);

  dailyDoubleContent.forEach((content, index) => {
    const key = shuffledKeys[index];
    if (key) {
      assignments[key] = content;
    }
  });

  return assignments;
}

function getDailyDoublePool(roundKey) {
  const optionalFeatures = state.spec.optional_features || {};

  if (roundKey === "round_1") {
    const roundOneDailyDouble = optionalFeatures.daily_double_round_1 || optionalFeatures.daily_double;
    return roundOneDailyDouble?.enabled ? [roundOneDailyDouble] : [];
  }

  if (roundKey === "round_2") {
    return (optionalFeatures.daily_doubles_round_2 || []).filter((item) => item.enabled);
  }

  return [];
}

function startGame() {
  const teamOneName = document.getElementById("team-1-input").value.trim() || "Team 1";
  const teamTwoName = document.getElementById("team-2-input").value.trim() || "Team 2";
  state.teamNames = [teamOneName, teamTwoName];
  state.gameStarted = true;
  applyTeamNames();
  updateStatus();
  startModal.close();
}

function applyTeamNames() {
  teamNameElements.forEach((element, index) => {
    element.textContent = state.teamNames[index];
  });

  scoreAdjustNameElements.forEach((element, index) => {
    element.textContent = state.teamNames[index];
  });

  dailyDoubleOptionElements.forEach((element, index) => {
    element.textContent = state.teamNames[index];
  });

  finalWagerLabelElements.forEach((element, index) => {
    element.textContent = state.teamNames[index];
  });

  finalCorrectButtons.forEach((button, index) => {
    button.textContent = `${state.teamNames[index]} Correct`;
  });
}

function getCurrentRoundKey() {
  return state.roundOrder[state.currentRoundIndex];
}

function getCurrentRound() {
  return state.spec[getCurrentRoundKey()];
}

function renderBoard() {
  boardElement.innerHTML = "";
  const round = getCurrentRound();
  const usedClues = state.usedCluesByRound[getCurrentRoundKey()];

  round.categories.forEach((category) => {
    const header = document.createElement("div");
    header.className = "category-header";
    header.textContent = category.title;
    boardElement.appendChild(header);
  });

  for (let rowIndex = 0; rowIndex < round.categories[0].clues.length; rowIndex += 1) {
    round.categories.forEach((category, categoryIndex) => {
      const clue = category.clues[rowIndex];
      const key = `${categoryIndex}-${rowIndex}`;
      const button = boardCellTemplate.content.firstElementChild.cloneNode(true);
      const isUsed = usedClues.has(key);

      button.textContent = isUsed ? "" : `$${clue.value}`;
      button.disabled = isUsed;
      button.classList.toggle("used", isUsed);
      button.setAttribute("aria-label", `${category.title} for ${clue.value}`);
      button.addEventListener("click", () => openClue(categoryIndex, rowIndex));
      boardElement.appendChild(button);
    });
  }
}

function openClue(categoryIndex, rowIndex) {
  if (!state.gameStarted) {
    startModal.showModal();
    return;
  }

  const roundKey = getCurrentRoundKey();
  const round = getCurrentRound();
  const category = round.categories[categoryIndex];
  const clue = category.clues[rowIndex];
  const key = `${categoryIndex}-${rowIndex}`;

  if (state.usedCluesByRound[roundKey].has(key)) {
    return;
  }

  const dailyDoubleContent = state.dailyDoubleAssignments[roundKey][key] || null;
  const isDailyDouble = Boolean(dailyDoubleContent);

  state.activeClue = {
    roundKey,
    key,
    value: clue.value,
    categoryTitle: category.title,
    isDailyDouble,
    prompt: isDailyDouble ? dailyDoubleContent.prompt || dailyDoubleContent.sample_prompt : clue.prompt,
    choices: isDailyDouble ? dailyDoubleContent.choices : clue.choices,
    correctIndex: isDailyDouble ? dailyDoubleContent.correct_index : clue.correct_index,
    explanation: isDailyDouble ? dailyDoubleContent.explanation || "Daily Double complete." : clue.explanation,
    attempts: [],
    resolved: false,
    scoringApplied: false,
    dailyDoubleTeam: 0,
    dailyDoubleWager: 0,
    dailyDoubleLimit: 0,
  };

  state.activeValue = clue.value;
  state.clueScoreAdjustments = ["none", "none"];

  resetClueModalState();
  modalCategoryElement.textContent = isDailyDouble ? "Daily Double" : category.title;
  modalTitleElement.textContent = isDailyDouble ? "Set Wager" : `For $${clue.value}`;

  if (isDailyDouble) {
    prepareDailyDoubleSetup();
  } else {
    showClueQuestion();
  }

  clueModal.showModal();
}

function resetClueModalState() {
  dailyDoubleSetupElement.hidden = true;
  clueQuestionBlockElement.hidden = true;
  modalFeedbackElement.hidden = true;
  modalFeedbackElement.className = "feedback";
  modalFeedbackElement.textContent = "";
  modalScoringElement.hidden = true;
  continueClueButton.hidden = true;
  continueClueButton.textContent = "Continue";
  scoringSummaryElement.textContent = "";
  modalChoicesElement.innerHTML = "";
}

function prepareDailyDoubleSetup() {
  dailyDoubleSetupElement.hidden = false;
  clueQuestionBlockElement.hidden = true;
  dailyDoubleTeamSelect.value = "0";
  updateDailyDoubleLimit();
}

function updateDailyDoubleLimit() {
  if (!state.activeClue?.isDailyDouble) {
    return;
  }

  const teamIndex = Number(dailyDoubleTeamSelect.value);
  const teamScore = state.teams[teamIndex];
  const limit = teamScore > 0 ? teamScore : DAILY_DOUBLE_FALLBACK_LIMIT;

  state.activeClue.dailyDoubleTeam = teamIndex;
  state.activeClue.dailyDoubleLimit = limit;
  dailyDoubleWagerInput.max = String(limit);
  dailyDoubleWagerInput.value = String(Math.min(state.activeClue.value, limit));
  dailyDoubleLimitElement.textContent = `${state.teamNames[teamIndex]} may wager from $0 to ${formatCurrency(limit)}.`;
}

function startDailyDoubleRound() {
  if (!state.activeClue?.isDailyDouble) {
    return;
  }

  const wager = Math.max(0, Number(dailyDoubleWagerInput.value) || 0);
  const limit = state.activeClue.dailyDoubleLimit;
  if (wager > limit) {
    dailyDoubleLimitElement.textContent = `Wager must be no more than ${formatCurrency(limit)}.`;
    return;
  }

  state.activeClue.dailyDoubleWager = wager;
  modalTitleElement.textContent = `Daily Double for ${formatCurrency(wager)}`;
  dailyDoubleSetupElement.hidden = true;
  showClueQuestion();
}

function showClueQuestion() {
  clueQuestionBlockElement.hidden = false;
  modalPromptElement.textContent = state.activeClue.prompt;
  populateChoices();
}

function populateChoices() {
  modalChoicesElement.innerHTML = "";

  state.activeClue.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = choice;
    button.addEventListener("click", () => handleChoiceSelection(index));
    modalChoicesElement.appendChild(button);
  });
}

function handleChoiceSelection(selectedIndex) {
  if (!state.activeClue || state.activeClue.resolved) {
    return;
  }

  const buttons = [...modalChoicesElement.querySelectorAll(".choice-button")];
  const selectedButton = buttons[selectedIndex];
  const isCorrect = selectedIndex === state.activeClue.correctIndex;

  if (isCorrect) {
    selectedButton.classList.add("correct");
    finalizeClueResolution(true, selectedIndex);
    return;
  }

  state.activeClue.attempts.push(selectedIndex);
  selectedButton.classList.add("incorrect");
  selectedButton.disabled = true;

  if (state.activeClue.isDailyDouble || state.activeClue.attempts.length >= 2) {
    finalizeClueResolution(false, selectedIndex);
    return;
  }

  modalFeedbackElement.hidden = false;
  modalFeedbackElement.className = "feedback incorrect";
  modalFeedbackElement.innerHTML = "<strong>Incorrect.</strong> The other team gets one remaining attempt.";
}

function finalizeClueResolution(answeredCorrectly, selectedIndex) {
  state.activeClue.resolved = true;
  state.usedCluesByRound[state.activeClue.roundKey].add(state.activeClue.key);

  const buttons = [...modalChoicesElement.querySelectorAll(".choice-button")];
  buttons.forEach((button, index) => {
    button.disabled = true;
    if (index === state.activeClue.correctIndex) {
      button.classList.add("correct");
    } else if (index === selectedIndex || state.activeClue.attempts.includes(index)) {
      button.classList.add("incorrect");
    }
  });

  modalFeedbackElement.hidden = false;
  modalFeedbackElement.className = `feedback ${answeredCorrectly ? "correct" : "incorrect"}`;

  if (state.activeClue.isDailyDouble) {
    const wager = state.activeClue.dailyDoubleWager;
    const teamIndex = state.activeClue.dailyDoubleTeam;
    adjustTeamScore(teamIndex, answeredCorrectly ? wager : -wager);
    state.activeClue.scoringApplied = true;
    modalFeedbackElement.innerHTML = `<strong>${answeredCorrectly ? "Correct!" : "Incorrect."}</strong> ${state.activeClue.explanation} ${state.teamNames[teamIndex]} ${answeredCorrectly ? "gains" : "loses"} ${formatCurrency(wager)}.`;
    continueClueButton.hidden = false;
    continueClueButton.textContent = "Continue";
  } else {
    modalFeedbackElement.innerHTML = `<strong>${answeredCorrectly ? "Correct!" : "Out of chances."}</strong> ${state.activeClue.explanation}`;
    modalScoringElement.hidden = false;
    scoringSummaryElement.textContent = `Clue value: ${formatCurrency(state.activeClue.value)} for each team.`;
    continueClueButton.hidden = false;
    continueClueButton.textContent = "Apply and Continue";
    syncScoringSelection();
  }

  renderBoard();
  updateStatus();
}

function syncScoringSelection() {
  document.querySelectorAll("[data-team-adjust-select]").forEach((button) => {
    const teamIndex = Number(button.dataset.teamAdjustSelect);
    const isActive = state.clueScoreAdjustments[teamIndex] === button.dataset.mode;
    button.classList.toggle("selected", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function handleClueContinue() {
  if (!state.activeClue?.resolved) {
    return;
  }

  if (!state.activeClue.isDailyDouble && !state.activeClue.scoringApplied) {
    state.clueScoreAdjustments.forEach((mode, teamIndex) => {
      if (mode === "add") {
        adjustTeamScore(teamIndex, state.activeClue.value);
      } else if (mode === "subtract") {
        adjustTeamScore(teamIndex, -state.activeClue.value);
      }
    });

    state.activeClue.scoringApplied = true;
  }

  closeClueModal();
}

function closeClueModal() {
  clueModal.close();
  state.activeClue = null;
  state.activeValue = 0;
  state.clueScoreAdjustments = ["none", "none"];
}

function handlePrimaryAction() {
  if (!state.gameStarted) {
    startModal.showModal();
    return;
  }

  if (hasNextRound() && isCurrentRoundCleared()) {
    advanceToNextRound();
    return;
  }

  if (!hasNextRound() && isCurrentRoundCleared()) {
    openFinalJeopardy();
  }
}

function advanceToNextRound() {
  if (!hasNextRound()) {
    return;
  }

  state.currentRoundIndex += 1;
  renderBoard();
  updateRoundIndicator();
  updateStatus();
}

function openFinalJeopardy() {
  if (!state.spec?.optional_features?.final_jeopardy?.enabled || !isCurrentRoundCleared() || hasNextRound()) {
    return;
  }

  const final = state.spec.optional_features.final_jeopardy;
  document.getElementById("final-prompt").textContent = final.prompt;
  document.getElementById("final-feedback").hidden = true;
  document.getElementById("final-feedback").className = "feedback";
  document.getElementById("final-award-actions").hidden = true;
  document.getElementById("final-wager-1").value = "0";
  document.getElementById("final-wager-2").value = "0";
  populateFinalChoices(final.choices, final.correct_index, final.explanation);
  finalModal.showModal();
}

function populateFinalChoices(choices, correctIndex, explanation) {
  const container = document.getElementById("final-choices");
  container.innerHTML = "";

  choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = choice;
    button.addEventListener("click", () => {
      const buttons = [...container.querySelectorAll(".choice-button")];
      buttons.forEach((choiceButton, innerIndex) => {
        choiceButton.disabled = true;
        if (innerIndex === correctIndex) {
          choiceButton.classList.add("correct");
        } else if (innerIndex === index) {
          choiceButton.classList.add("incorrect");
        }
      });

      const feedback = document.getElementById("final-feedback");
      const isCorrect = index === correctIndex;
      feedback.hidden = false;
      feedback.className = `feedback ${isCorrect ? "correct" : "incorrect"}`;
      feedback.innerHTML = `<strong>${isCorrect ? "Correct!" : "Incorrect."}</strong> ${explanation}`;
      document.getElementById("final-award-actions").hidden = false;
    });
    container.appendChild(button);
  });
}

function applyFinalJeopardy(result) {
  if (state.finalAnswered) {
    return;
  }

  const wagers = [
    Math.max(0, Number(document.getElementById("final-wager-1").value) || 0),
    Math.max(0, Number(document.getElementById("final-wager-2").value) || 0),
  ];

  if (result === "0" || result === "both") {
    adjustTeamScore(0, wagers[0]);
  } else {
    adjustTeamScore(0, -wagers[0]);
  }

  if (result === "1" || result === "both") {
    adjustTeamScore(1, wagers[1]);
  } else {
    adjustTeamScore(1, -wagers[1]);
  }

  state.finalAnswered = true;
  finalModal.close();
  updateStatus();
}

function adjustTeamScore(teamIndex, delta) {
  state.teams[teamIndex] += delta;
  updateScoreDisplay();
}

function updateScoreDisplay() {
  document.getElementById("team-1-score").textContent = formatCurrency(state.teams[0]);
  document.getElementById("team-2-score").textContent = formatCurrency(state.teams[1]);
}

function updateRoundIndicator() {
  roundIndicatorElement.textContent = getCurrentRound().title;
}

function updateStatus() {
  if (!state.spec) {
    return;
  }

  if (!state.gameStarted) {
    statusTextElement.textContent = "Enter team names to begin.";
    primaryActionButton.disabled = true;
    primaryActionButton.textContent = "Open Final Jeopardy";
    return;
  }

  if (state.finalAnswered) {
    const leader = state.teams[0] === state.teams[1]
      ? "It's a tie game."
      : `${state.teamNames[state.teams[0] > state.teams[1] ? 0 : 1]} is in the lead.`;
    statusTextElement.textContent = `Final Jeopardy complete. ${leader}`;
    primaryActionButton.disabled = true;
    primaryActionButton.textContent = "Final Jeopardy Complete";
    return;
  }

  if (isCurrentRoundCleared()) {
    if (hasNextRound()) {
      const nextRound = state.spec[state.roundOrder[state.currentRoundIndex + 1]];
      statusTextElement.textContent = `${getCurrentRound().title} complete. Ready to begin ${nextRound.title}.`;
      primaryActionButton.disabled = false;
      primaryActionButton.textContent = `Start ${nextRound.title}`;
      return;
    }

    statusTextElement.textContent = `${getCurrentRound().title} complete. Final Jeopardy is ready.`;
    primaryActionButton.disabled = false;
    primaryActionButton.textContent = "Open Final Jeopardy";
    return;
  }

  const remainingClues = getCurrentRound().categories.length * getCurrentRound().categories[0].clues.length - state.usedCluesByRound[getCurrentRoundKey()].size;
  const hiddenDailyDoubles = countHiddenDailyDoubles(getCurrentRoundKey());
  statusTextElement.textContent = `${remainingClues} clue${remainingClues === 1 ? "" : "s"} remaining in ${getCurrentRound().title}. ${hiddenDailyDoubles} Daily Double${hiddenDailyDoubles === 1 ? "" : "s"} still hidden.`;
  primaryActionButton.disabled = true;
  primaryActionButton.textContent = hasNextRound() ? `Start ${state.spec[state.roundOrder[state.currentRoundIndex + 1]].title}` : "Open Final Jeopardy";
}

function countHiddenDailyDoubles(roundKey) {
  const allDailyDoubleKeys = Object.keys(state.dailyDoubleAssignments[roundKey] || {});
  const usedClues = state.usedCluesByRound[roundKey] || new Set();
  return allDailyDoubleKeys.filter((key) => !usedClues.has(key)).length;
}

function isCurrentRoundCleared() {
  const roundKey = getCurrentRoundKey();
  const round = getCurrentRound();
  const totalClues = round.categories.length * round.categories[0].clues.length;
  return state.usedCluesByRound[roundKey].size === totalClues;
}

function hasNextRound() {
  return state.currentRoundIndex < state.roundOrder.length - 1;
}

function resetGame() {
  state.teams = [0, 0];
  state.gameStarted = false;
  buildFreshGameState();
  renderBoard();
  updateScoreDisplay();
  updateRoundIndicator();
  updateStatus();
  syncStartInputs();
  startModal.showModal();
}

function syncStartInputs() {
  document.getElementById("team-1-input").value = state.teamNames[0];
  document.getElementById("team-2-input").value = state.teamNames[1];
}

function shuffleArray(items) {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

function formatCurrency(value) {
  const prefix = value < 0 ? "-$" : "$";
  return `${prefix}${Math.abs(value)}`;
}

init();

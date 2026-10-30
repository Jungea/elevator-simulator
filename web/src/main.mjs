import { ElevatorGame, PASSENGER_TYPE } from "./game.mjs";

const elements = {
  floorList: document.querySelector("#floor-list"),
  floorInputDisplay: document.querySelector("#floor-input-display"),
  waitingList: document.querySelector("#waiting-list"),
  passengerList: document.querySelector("#passenger-list"),
  currentFloor: document.querySelector("#current-floor"),
  ledBackground: document.querySelector("#led-background"),
  floorDisplay: document.querySelector("#floor-display"),
  moveButton: document.querySelector("#move-button"),
  restartButton: document.querySelector("#restart-button"),
  newGameButton: document.querySelector("#new-game-button"),
  modalRestartButton: document.querySelector("#modal-restart-button"),
  gameStatus: document.querySelector("#game-status"),
  capacityLabel: document.querySelector("#capacity-label"),
  directionLabel: document.querySelector("#direction-label"),
  resultModal: document.querySelector("#result-modal"),
  resultKicker: document.querySelector("#result-kicker"),
  resultTitle: document.querySelector("#result-title"),
  resultMessage: document.querySelector("#result-message"),
};

const SAVE_KEY = "elevator-simulator-save-v1";
let game = new ElevatorGame();
let savedUi = null;
try {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
  game.restore(saved?.game ?? saved);
  savedUi = saved?.ui ?? null;
} catch {
  localStorage.removeItem(SAVE_KEY);
}
let visualFloor = game.currentFloor;
let isAnimating = false;
let travelDirection = 0;
let showResult = false;
let displayedPassengers = null;
let activeTargetFloor = null;
let isAtDestinationStop = false;
let isSelectingNextFloor = true;
let isStopping = false;
let floorInput = "";
let basementInput = false;
let invalidInputTimer = null;

if (savedUi) {
  visualFloor = savedUi.visualFloor ?? visualFloor;
  activeTargetFloor = savedUi.activeTargetFloor ?? null;
  floorInput = savedUi.floorInput ?? "";
  basementInput = savedUi.basementInput ?? false;
}
showResult = game.status !== "playing";

const FLOOR_TRAVEL_MS = 1200;
const STOP_STEP_MS = 140;

const DOT_MATRIX = {
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
};

const DOT_ARROWS = {
  up: ["00100", "01010", "10001", "00000", "00000", "00000", "00000"],
  down: ["00000", "00000", "00000", "10001", "01010", "00100", "00000"],
};

const PASSENGER_EMOJIS = [
  "🧑‍💼",
  "👩‍💼",
  "👨‍💻",
  "👩‍🔬",
  "🧑‍🔧",
  "👨‍🚀",
  "👩‍🎨",
  "🧑‍🏫",
];

function getPassengerEmoji(passenger) {
  const seed = [...passenger.id].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return PASSENGER_EMOJIS[seed % PASSENGER_EMOJIS.length];
}

function renderDigitalFloor(floor) {
  const value = floor < 0 ? `B${Math.abs(floor)}` : String(floor);
  elements.currentFloor.replaceChildren();
  elements.currentFloor.setAttribute("aria-label", `${floor}층`);
  elements.currentFloor.classList.remove("full-dot-display");
  for (const [index, character] of [...value].entries()) {
    const digit = document.createElement("span");
    digit.className = "digital-digit";
    const matrix = DOT_MATRIX[character] ?? DOT_MATRIX[0];
    for (const row of matrix) {
      for (const isOn of row) {
        const dot = document.createElement("i");
        dot.className = `dot${isOn === "1" ? " is-on" : ""}`;
        digit.append(dot);
      }
    }
    elements.currentFloor.append(digit);
    if (index === 0) {
      const spacer = document.createElement("span");
      spacer.className = "digital-spacer-column";
      elements.currentFloor.append(spacer);
    }
  }
}

function renderInputDisplay(value) {
  const text = value || "--";
  elements.floorInputDisplay.textContent = text;
}

function renderLedBackground(floor, direction = 0) {
  elements.ledBackground.replaceChildren();
  const value = floor < 0 ? `B${Math.abs(floor)}` : String(floor);
  const active = new Set();
  const arrowActive = new Set();
  const offsets = value.length === 1 ? [13, 13] : [7, 13];
  [...value].forEach((character, characterIndex) => {
    const matrix = DOT_MATRIX[character] ?? DOT_MATRIX[0];
    matrix.forEach((row, rowIndex) => {
      [...row].forEach((cell, columnIndex) => {
        if (cell === "1") active.add(`${rowIndex + 1}:${offsets[characterIndex] + columnIndex}`);
      });
    });
  });
  const upArrow = ["00100", "01010", "10001", "00000", "00000"];
  const downArrow = ["00000", "00000", "10001", "01010", "00100"];
  const arrows = direction > 0
    ? [[upArrow, 1]]
    : direction < 0
      ? [[downArrow, 19]]
      : [];
  for (const [matrix, offset] of arrows) {
    matrix.forEach((row, rowIndex) => {
      [...row].forEach((cell, columnIndex) => {
        if (cell === "1") {
          const key = `${rowIndex + 2}:${offset + columnIndex}`;
          active.add(key);
          arrowActive.add(key);
        }
      });
    });
  }
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 25; column += 1) {
      const dot = document.createElement("i");
      const key = `${row}:${column}`;
      dot.className = `led-background-dot${active.has(key) ? " is-active" : ""}${arrowActive.has(key) ? " is-arrow" : ""}`;
      elements.ledBackground.append(dot);
    }
  }
}

function renderDotArrow(element, matrix) {
  element.replaceChildren();
  element.classList.add("dot-arrow-preview");
  for (const row of matrix) {
    for (const isOn of row) {
      const dot = document.createElement("i");
      dot.className = `direction-preview-dot${isOn === "1" ? " is-on" : ""}`;
      element.append(dot);
    }
  }
}

function getSignalClass(passenger) {
  const ratio = passenger.remainingDistance / passenger.maxDistance;
  if (ratio <= 0.25) return "red";
  if (ratio <= 0.5) return "yellow";
  return "green";
}

function renderFloors() {
  elements.floorList.replaceChildren();
  renderInputDisplay(floorInput || basementInput ? `${basementInput ? "B" : ""}${floorInput || (basementInput ? "_" : "")}` : "--");
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "B", "0", "C"];
  for (const key of keys) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "floor-row keypad-button";
    button.textContent = key;
    button.disabled = game.status !== "playing" || isAnimating;
    button.addEventListener("click", () => handleFloorKey(key));
    elements.floorList.append(button);
  }
}

function handleFloorKey(key) {
  if (!isAnimating && game.selectedFloor === null && floorInput) {
    floorInput = "";
    basementInput = false;
  }
  if (key === "C") {
    floorInput = "";
    basementInput = false;
  } else if (key === "B") {
    floorInput = "";
    basementInput = true;
  } else if (floorInput.length < 2) {
    if (!basementInput && floorInput === "" && key === "0") return;
    floorInput += key;
    const floor = basementInput ? -Number(floorInput) : Number(floorInput);
    if (floor < (game.stage.minFloor ?? 1) || floor > (game.stage.maxFloor ?? game.stage.floorCount) || floor === 0 || floor === game.currentFloor) {
      const attemptedInput = `${basementInput ? "B" : ""}${floorInput}`;
      floorInput = "";
      basementInput = false;
      game.selectedFloor = null;
      activeTargetFloor = null;
      if (invalidInputTimer) clearTimeout(invalidInputTimer);
      elements.floorInputDisplay.textContent = attemptedInput;
      elements.floorInputDisplay.classList.add("is-invalid");
      invalidInputTimer = setTimeout(() => {
        invalidInputTimer = setTimeout(() => {
          invalidInputTimer = null;
          elements.floorInputDisplay.classList.remove("is-invalid");
          render();
        }, 500);
      }, 250);
      return;
    } else {
      game.selectFloor(floor);
      activeTargetFloor = floor;
    }
  }
  render();
}

function renderWaiting() {
  elements.waitingList.replaceChildren();

  const minFloor = game.stage.minFloor ?? 1;
  const maxFloor = game.stage.maxFloor ?? game.stage.floorCount;
  for (let floor = maxFloor; floor >= minFloor; floor -= 1) {
    if (floor === 0) continue;
    const row = document.createElement("div");
    const waitingCount = game.getWaitingCount(floor);
    row.className = "waiting-row";
    row.classList.toggle("is-current", floor === visualFloor);
    row.innerHTML = `
      <span class="waiting-floor">${floor < 0 ? `B${Math.abs(floor)}` : `${floor}F`}</span>
      <span class="waiting-label">${floor === game.stage.ceoFloor ? "대표실" : ""}</span>
      <strong>${floor === game.stage.ceoFloor ? "—" : `${waitingCount}명`}</strong>
    `;
    elements.waitingList.append(row);
  }
}

function renderPassengers() {
  elements.passengerList.replaceChildren();

  if (game.passengers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-cabin";
    empty.textContent = "운행 완료";
    elements.passengerList.append(empty);
    return;
  }

  for (const passenger of displayedPassengers ?? game.passengers) {
    const card = document.createElement("article");
    const isCeo = passenger.type === PASSENGER_TYPE.CEO;
    const signalClass = isCeo ? "" : getSignalClass(passenger);
    const avatar = `<div class="passenger-avatar" aria-hidden="true">${getPassengerEmoji(passenger)}</div>`;
    card.className = `passenger-card${isCeo ? " is-ceo" : ""}${signalClass ? ` status-${signalClass}` : ""}`;

    const status = isCeo
      ? ""
      : `<div class="passenger-condition">
          <i class="signal ${signalClass}"></i>
          <strong>${passenger.remainingDistance}/${passenger.maxDistance}</strong>
        </div>`;

    card.innerHTML = `
      ${avatar}
      <div class="passenger-copy"><strong>${passenger.name}</strong></div>
      <div class="passenger-destination">
        <strong>${passenger.destinationFloor}F</strong>
      </div>
      ${status}
    `;
    elements.passengerList.append(card);
  }
}

function renderResult() {
  if (game.status === "playing" || !showResult) {
    elements.resultModal.hidden = true;
    return;
  }

  const isClear = game.status === "clear";
  elements.resultKicker.textContent = isClear ? "MISSION COMPLETE" : "OPERATION FAILED";
  elements.resultTitle.textContent = isClear
    ? "대표님이 무사히 출근했어요!"
    : game.failureReason === "ceo_office_infiltration"
      ? "산업 스파이!"
      : "월급루팡!";
  elements.resultMessage.textContent = isClear
    ? `${game.turn}회의 이동으로 대표를 무사히 모셨습니다.`
    : game.failureReason === "ceo_office_infiltration"
      ? "직원은 대표실에 들어오면 안 됩니다."
      : "남은 층수 안에 직원을 목표 층수로 이동시켜야 합니다.";
  elements.resultModal.classList.toggle("is-failure", !isClear);
  elements.resultModal.hidden = false;
}

function render() {
  persistState();
  renderLedBackground(visualFloor, isAnimating ? travelDirection : 0);
  renderFloors();
  renderWaiting();
  renderPassengers();
  renderResult();

  renderDigitalFloor(visualFloor);
  elements.capacityLabel.textContent = `${game.passengers.length} / ${game.stage.capacity}`;
  elements.moveButton.disabled =
    game.status !== "playing" || (isAnimating && !isStopping) ||
    (!isStopping && game.selectedFloor === null);
  elements.moveButton.classList.toggle("is-stopping", isStopping);
  elements.moveButton.classList.toggle(
    "is-ready",
    !isAnimating && game.status === "playing" && game.selectedFloor !== null,
  );
  const hasDirection = isAnimating && travelDirection !== 0 && !isAtDestinationStop;
  const isMoving = hasDirection && !isStopping;
  elements.floorDisplay.classList.toggle("is-arrow-blinking", isMoving);
  const directionIcon = document.createElement("span");
  directionIcon.className = "direction-arrow";
  directionIcon.setAttribute("aria-hidden", "true");
  const arrowMatrix = DOT_ARROWS[travelDirection > 0 ? "up" : "down"];
  for (const row of arrowMatrix) {
    for (const isOn of row) {
      const dot = document.createElement("i");
      dot.className = `direction-dot${isOn === "1" ? " is-on" : ""}`;
      directionIcon.append(dot);
    }
  }
  elements.directionLabel.replaceChildren(directionIcon);
  elements.directionLabel.hidden = !hasDirection;
  elements.directionLabel.classList.toggle("is-down", hasDirection && travelDirection < 0);
  elements.directionLabel.classList.toggle("is-visible", hasDirection);
  elements.directionLabel.classList.toggle("is-moving", isMoving);
  elements.directionLabel.setAttribute(
    "aria-label",
    isMoving ? (travelDirection > 0 ? "상행" : "하행") : "이동 방향 없음",
  );
  window.lucide?.createIcons();
  const statusLabel =
    game.status === "playing" ? "운행 중" : game.status === "clear" ? "완료" : "중단";
  elements.gameStatus.textContent = "";
  elements.gameStatus.title = statusLabel;
  elements.gameStatus.setAttribute("aria-label", statusLabel);
  elements.gameStatus.classList.toggle("is-clear", game.status === "clear");
  elements.gameStatus.classList.toggle("is-over", game.status === "game_over");
}

function persistState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    game: game.snapshot(),
    ui: { visualFloor, activeTargetFloor, floorInput, basementInput },
  }));
}

window.addEventListener("beforeunload", persistState);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function animateSegment(events) {
  const travelEvents = events.filter(
    (event) => event.type === "travel" || event.type === "stop",
  );

  isAnimating = true;
  showResult = false;
  render();

  for (const event of travelEvents) {
    if (event.type === "travel" && event.floor === 0) continue;
    visualFloor = event.floor;
    displayedPassengers = event.type === "travel" && event.passengers
      ? event.passengers
      : null;
    isStopping = event.type === "stop";
    render();
    if (event.type === "stop") {
      isAtDestinationStop = game.currentFloor === game.targetFloor;
      isStopping = false;
      while (game.pendingStop) {
        const stepEvents = game.resolveStopStep();
        displayedPassengers = null;
        render();
        if (stepEvents.length > 0) await wait(STOP_STEP_MS);
      }
      if (game.routeActive && game.status === "playing") {
        isStopping = true;
        render();
      }
      break;
    }
    await wait(FLOOR_TRAVEL_MS);
  }

  if (!game.routeActive || game.status !== "playing") {
    displayedPassengers = null;
    visualFloor = game.currentFloor;
    isAnimating = false;
    isStopping = false;
    showResult = true;
    activeTargetFloor = null;
    isAtDestinationStop = false;
    isSelectingNextFloor = game.status === "playing";
    render();
  } else {
    displayedPassengers = null;
    isStopping = true;
    render();
  }
}

function restart() {
  game = new ElevatorGame();
  localStorage.removeItem(SAVE_KEY);
  savedUi = null;
  floorInput = "";
  basementInput = false;
  visualFloor = game.currentFloor;
  isAnimating = false;
  isStopping = false;
  isAtDestinationStop = false;
  isSelectingNextFloor = true;
  travelDirection = 0;
  showResult = false;
  displayedPassengers = null;
  activeTargetFloor = null;
  renderDigitalFloor(game.currentFloor);
  render();
}

elements.moveButton.addEventListener("click", async () => {
  if (isStopping) {
    isStopping = false;
    if (!game.routeActive) {
      isAnimating = false;
      showResult = true;
      activeTargetFloor = null;
      isAtDestinationStop = false;
      render();
      return;
    }
    const events = game.continueMove();
    await animateSegment(events);
    return;
  }
  if (isAnimating) return;
  const selectedFloor = game.selectedFloor;
  if (selectedFloor === null) return;
  activeTargetFloor = selectedFloor;
  isSelectingNextFloor = false;
  travelDirection = Math.sign(selectedFloor - game.currentFloor);
  const events = game.beginMove();
  await animateSegment(events);
});
elements.restartButton.addEventListener("click", restart);
elements.newGameButton.addEventListener("click", restart);
elements.modalRestartButton.addEventListener("click", restart);

render();

if (savedUi && game.status === "playing" && game.routeActive && visualFloor !== game.currentFloor) {
  game.currentFloor = visualFloor;
  game.pendingStop = null;
  isAnimating = true;
  travelDirection = Math.sign(game.targetFloor - game.currentFloor);
  void animateSegment(game.continueMove());
}


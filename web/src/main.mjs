import { ElevatorGame, PASSENGER_TYPE } from "./game.mjs";

const elements = {
  floorList: document.querySelector("#floor-list"),
  waitingList: document.querySelector("#waiting-list"),
  passengerList: document.querySelector("#passenger-list"),
  currentFloor: document.querySelector("#current-floor"),
  moveButton: document.querySelector("#move-button"),
  restartButton: document.querySelector("#restart-button"),
  modalRestartButton: document.querySelector("#modal-restart-button"),
  gameStatus: document.querySelector("#game-status"),
  capacityLabel: document.querySelector("#capacity-label"),
  directionLabel: document.querySelector("#direction-label"),
  resultModal: document.querySelector("#result-modal"),
  resultKicker: document.querySelector("#result-kicker"),
  resultTitle: document.querySelector("#result-title"),
  resultMessage: document.querySelector("#result-message"),
};

let game = new ElevatorGame();
let visualFloor = game.currentFloor;
let isAnimating = false;
let travelDirection = 0;
let showResult = false;
let displayedPassengers = null;
let activeTargetFloor = null;
let isAtDestinationStop = false;
let isSelectingNextFloor = true;
let isStopping = false;

const FLOOR_TRAVEL_MS = 1200;
const STOP_STEP_MS = 140;

const DIGITAL_SEGMENTS = {
  0: ["a", "b", "c", "d", "e", "f"],
  1: ["b", "c"],
  2: ["a", "b", "g", "e", "d"],
  3: ["a", "b", "c", "d", "g"],
  4: ["f", "g", "b", "c"],
  5: ["a", "f", "g", "c", "d"],
  6: ["a", "f", "g", "e", "c", "d"],
  7: ["a", "b", "c"],
  8: ["a", "b", "c", "d", "e", "f", "g"],
  9: ["a", "b", "c", "d", "f", "g"],
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
  const value = floor < 0 ? `B${Math.abs(floor)}` : String(floor).padStart(2, "0");
  elements.currentFloor.replaceChildren();
  elements.currentFloor.setAttribute("aria-label", `${floor}층`);

  for (const character of value) {
    const digit = document.createElement("span");
    digit.className = "digital-digit";
    digit.setAttribute("aria-hidden", "true");
    const activeSegments = DIGITAL_SEGMENTS[character] ?? [];

    for (const segmentName of ["a", "b", "c", "d", "e", "f", "g"]) {
      const segment = document.createElement("i");
      segment.className = `segment segment-${segmentName}${activeSegments.includes(segmentName) ? " is-on" : ""}`;
      digit.append(segment);
    }
    elements.currentFloor.append(digit);
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
  const minFloor = game.stage.minFloor ?? 1;
  const maxFloor = game.stage.maxFloor ?? game.stage.floorCount;
  const leftColumn = [4, 3, 2, 1, -1, -2].filter((floor) => floor >= minFloor && floor <= maxFloor);
  const rightColumn = [10, 9, 8, 7, 6, 5].filter((floor) => floor >= minFloor && floor <= maxFloor);
  const floorOrder = [];
  for (let row = 0; row < Math.max(leftColumn.length, rightColumn.length); row += 1) {
    if (leftColumn[row] !== undefined) floorOrder.push(leftColumn[row]);
    if (rightColumn[row] !== undefined) floorOrder.push(rightColumn[row]);
  }

  for (const floor of floorOrder) {
    const button = document.createElement("button");
    const isMovingTarget = isAnimating && floor === activeTargetFloor;
    const isCurrentFloor = floor === game.currentFloor;
    const isCurrent = isMovingTarget || (!isAnimating && isCurrentFloor);
    const isAvailable =
      isSelectingNextFloor && game.selectedFloor === null && !isCurrentFloor;
    const isSelected =
      !isMovingTarget && (floor === game.selectedFloor || floor === activeTargetFloor);
    const waitingCount = game.getWaitingCount(floor);

    button.type = "button";
    button.className = "floor-row";
    button.classList.toggle("is-current", isCurrent);
    button.classList.toggle("is-available", isAvailable);
    button.classList.toggle("is-selected", isSelected);
    button.disabled = isCurrentFloor || game.status !== "playing" || isAnimating;
    button.setAttribute("aria-pressed", String(isSelected));
    button.innerHTML = `
      <span class="floor-number">${floor < 0 ? `B${Math.abs(floor)}` : floor}</span>
    `;
    button.setAttribute(
      "aria-label",
      `${floor}층${floor === game.stage.ceoFloor ? " 대표실" : ""}${waitingCount > 0 ? ` 대기 ${waitingCount}명` : ""}`,
    );
    button.addEventListener("click", () => {
      game.selectFloor(floor);
      activeTargetFloor = floor;
      render();
    });
    elements.floorList.append(button);
  }
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
  const directionIcon = document.createElement("i");
  directionIcon.dataset.lucide = travelDirection > 0 ? "arrow-up" : "arrow-down";
  directionIcon.className = "direction-arrow";
  directionIcon.setAttribute("aria-hidden", "true");
  elements.directionLabel.replaceChildren(directionIcon);
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
elements.modalRestartButton.addEventListener("click", restart);

render();


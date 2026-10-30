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
let activeTargetFloor = null;
let travelStartFloor = game.currentFloor;
let isStopping = false;

const FLOOR_TRAVEL_MS = 350;
const STOP_DWELL_MS = 900;

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

function renderDigitalFloor(floor) {
  const value = String(floor).padStart(2, "0");
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
  const midpoint = Math.ceil(game.stage.floorCount / 2);
  const floorOrder = [];

  for (let floor = midpoint; floor >= 1; floor -= 1) {
    const upperFloor = floor + midpoint;
    if (floor <= game.stage.floorCount) floorOrder.push(floor);
    if (upperFloor <= game.stage.floorCount) floorOrder.push(upperFloor);
  }

  for (const floor of floorOrder) {
    const button = document.createElement("button");
    const currentButtonFloor = isAnimating
      ? travelStartFloor
      : game.currentFloor;
    const isCurrent = floor === currentButtonFloor;
    const isSelected =
      floor === game.selectedFloor || floor === activeTargetFloor;
    const waitingCount = game.getWaitingCount(floor);

    button.type = "button";
    button.className = "floor-row";
    button.classList.toggle("is-current", isCurrent);
    button.classList.toggle("is-selected", isSelected);
    button.disabled = isCurrent || game.status !== "playing" || isAnimating;
    button.setAttribute("aria-pressed", String(isSelected));
    button.innerHTML = `
      <span class="floor-number">${floor}</span>
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

  for (let floor = game.stage.floorCount; floor >= 1; floor -= 1) {
    const row = document.createElement("div");
    const waitingCount = game.getWaitingCount(floor);
    row.className = "waiting-row";
    row.classList.toggle("is-current", floor === visualFloor);
    row.innerHTML = `
      <span class="waiting-floor">${floor}F</span>
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

  for (const passenger of game.passengers) {
    const card = document.createElement("article");
    const isCeo = passenger.type === PASSENGER_TYPE.CEO;
    card.className = `passenger-card${isCeo ? " is-ceo" : ""}`;

    const status = isCeo
      ? ""
      : `<div class="passenger-condition">
          <i class="signal ${getSignalClass(passenger)}"></i>
          <strong>${passenger.remainingDistance}/${passenger.maxDistance}</strong>
        </div>`;

    card.innerHTML = `
      <div class="passenger-avatar" aria-hidden="true">${isCeo ? "代" : passenger.name[0]}</div>
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
  elements.resultTitle.textContent = isClear ? "대표실 도착 완료" : "업무방해 발생";
  elements.resultMessage.textContent = isClear
    ? `${game.turn}회의 이동으로 대표를 무사히 모셨습니다.`
    : "직원의 상태가 0이 되었습니다. 이동 순서를 다시 설계해 보세요.";
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
    game.selectedFloor === null || game.status !== "playing" || isAnimating;
  elements.moveButton.classList.toggle("is-stopping", isStopping);
  const isMoving = isAnimating && travelDirection !== 0;
  const directionIcon = document.createElement("i");
  directionIcon.dataset.lucide = travelDirection > 0 ? "arrow-up" : "arrow-down";
  directionIcon.className = "direction-arrow";
  directionIcon.setAttribute("aria-hidden", "true");
  elements.directionLabel.replaceChildren(directionIcon);
  elements.directionLabel.classList.toggle("is-down", isMoving && travelDirection < 0);
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

async function animateTravel(events) {
  const travelEvents = events.filter(
    (event) => event.type === "travel" || event.type === "stop",
  );

  isAnimating = true;
  showResult = false;
  render();

  for (const event of travelEvents) {
    visualFloor = event.floor;
    isStopping = event.type === "stop";
    render();
    await wait(event.type === "stop" ? STOP_DWELL_MS : FLOOR_TRAVEL_MS);
  }

  visualFloor = game.currentFloor;
  isAnimating = false;
  isStopping = false;
  showResult = true;
  activeTargetFloor = null;
  render();
}

function restart() {
  game = new ElevatorGame();
  visualFloor = game.currentFloor;
  isAnimating = false;
  isStopping = false;
  travelDirection = 0;
  showResult = false;
  activeTargetFloor = null;
  travelStartFloor = game.currentFloor;
  renderDigitalFloor(game.currentFloor);
  render();
}

elements.moveButton.addEventListener("click", async () => {
  if (isAnimating) return;
  const selectedFloor = game.selectedFloor;
  if (selectedFloor === null) return;
  travelStartFloor = game.currentFloor;
  activeTargetFloor = selectedFloor;
  travelDirection = Math.sign(selectedFloor - game.currentFloor);
  const events = game.move();
  await animateTravel(events);
});
elements.restartButton.addEventListener("click", restart);
elements.modalRestartButton.addEventListener("click", restart);

render();


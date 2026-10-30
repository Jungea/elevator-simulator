import assert from "node:assert/strict";
import test from "node:test";

import { ElevatorGame } from "../src/game.mjs";

test("현재 층은 목표층으로 선택할 수 없다", () => {
  const game = new ElevatorGame();
  assert.equal(game.selectFloor(1), false);
  assert.equal(game.selectedFloor, null);
});

test("이동 경로에 대기자가 있고 빈자리가 있으면 자동 정차한다", () => {
  const game = new ElevatorGame();
  game.selectFloor(3);
  const events = game.move();

  assert.deepEqual(
    events.filter((event) => event.type === "stop").map((event) => event.floor),
    [2, 3],
  );
  assert.equal(game.currentFloor, 3);
  assert.deepEqual(
    game.passengers.map((passenger) => passenger.name),
    ["대표", "박사원", "이과장"],
  );
});

test("중간 정차마다 닫기 전에는 다음 층으로 진행하지 않는다", () => {
  const game = new ElevatorGame();
  game.selectFloor(5);

  game.beginMove();
  assert.equal(game.currentFloor, 2);
  assert.equal(game.routeActive, true);
  assert.equal(game.getWaitingCount(3), 1);

  while (game.pendingStop) game.resolveStopStep();
  assert.equal(game.passengers.some((passenger) => passenger.name === "박사원"), true);
  game.continueMove();
  while (game.pendingStop) game.resolveStopStep();
  assert.equal(game.currentFloor, 3);
  assert.equal(game.getWaitingCount(3), 0);
});

test("목적층 도착 직원은 상태 차감 전에 하차한다", () => {
  const game = new ElevatorGame();
  game.selectFloor(3);
  game.move();

  assert.equal(
    game.passengers.some((passenger) => passenger.name === "김대리"),
    false,
  );
});

test("프로토타입 스테이지에 클리어 경로가 존재한다", () => {
  const game = new ElevatorGame();
  const route = [3, 1, 5, 10, 2, 10];

  for (const floor of route) {
    game.selectFloor(floor);
    game.move();
    if (game.status !== "playing") break;
  }

  assert.equal(game.status, "clear");
  assert.equal(game.currentFloor, 10);
});

test("엘리베이터가 가득 차면 대기자만 있는 층을 통과한다", () => {
  const game = new ElevatorGame({
    id: "capacity-test",
    name: "정원 테스트",
    floorCount: 4,
    ceoFloor: 4,
    capacity: 3,
    initialFloor: 1,
    initialPassengers: [
      { id: "ceo", type: "ceo", name: "대표", destinationFloor: 4 },
      {
        id: "a",
        type: "employee",
        name: "직원 A",
        destinationFloor: 4,
        maxDistance: 10,
      },
      {
        id: "b",
        type: "employee",
        name: "직원 B",
        destinationFloor: 4,
        maxDistance: 10,
      },
    ],
    waitingPassengers: {
      2: [
        {
          id: "waiting",
          type: "employee",
          name: "대기 직원",
          destinationFloor: 1,
          maxDistance: 4,
        },
      ],
    },
  });

  game.selectFloor(3);
  const events = game.move();

  assert.deepEqual(
    events.filter((event) => event.type === "stop").map((event) => event.floor),
    [3],
  );
  assert.equal(game.getWaitingCount(2), 1);
});

test("상태가 0 이하가 되면 즉시 게임 오버다", () => {
  const game = new ElevatorGame({
    id: "game-over-test",
    name: "실패 테스트",
    floorCount: 5,
    ceoFloor: 5,
    capacity: 2,
    initialFloor: 1,
    initialPassengers: [
      { id: "ceo", type: "ceo", name: "대표", destinationFloor: 5 },
      {
        id: "employee",
        type: "employee",
        name: "직원",
        destinationFloor: 5,
        maxDistance: 2,
      },
    ],
    waitingPassengers: {},
  });

  game.selectFloor(4);
  game.move();

  assert.equal(game.status, "game_over");
});


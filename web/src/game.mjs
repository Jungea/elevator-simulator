export const PASSENGER_TYPE = Object.freeze({
  CEO: "ceo",
  EMPLOYEE: "employee",
});

export function createPrototypeStage() {
  return {
    id: "release-0-prototype",
    name: "월요일의 대표님",
    floorCount: 10,
    ceoFloor: 10,
    capacity: 3,
    initialFloor: 1,
    initialPassengers: [
      {
        id: "ceo",
        type: PASSENGER_TYPE.CEO,
        name: "대표",
        destinationFloor: 10,
      },
      {
        id: "employee-a",
        type: PASSENGER_TYPE.EMPLOYEE,
        name: "김대리",
        destinationFloor: 3,
        maxDistance: 10,
      },
    ],
    waitingPassengers: {
      2: [
        {
          id: "employee-b",
          type: PASSENGER_TYPE.EMPLOYEE,
          name: "박사원",
          destinationFloor: 5,
          maxDistance: 8,
        },
      ],
      3: [
        {
          id: "employee-c",
          type: PASSENGER_TYPE.EMPLOYEE,
          name: "이과장",
          destinationFloor: 1,
          maxDistance: 8,
        },
      ],
      6: [
        {
          id: "employee-d",
          type: PASSENGER_TYPE.EMPLOYEE,
          name: "최주임",
          destinationFloor: 2,
          maxDistance: 5,
        },
      ],
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function preparePassenger(passenger, boardingFloor) {
  const prepared = clone(passenger);
  prepared.boardingFloor = boardingFloor;

  if (prepared.type === PASSENGER_TYPE.EMPLOYEE) {
    prepared.remainingDistance = prepared.maxDistance;
  }

  return prepared;
}

export class ElevatorGame {
  constructor(stage = createPrototypeStage()) {
    this.stage = clone(stage);
    this.reset();
  }

  reset() {
    this.status = "playing";
    this.currentFloor = this.stage.initialFloor;
    this.selectedFloor = null;
    this.targetFloor = null;
    this.routeActive = false;
    this.pendingStop = null;
    this.turn = 0;
    this.passengers = this.stage.initialPassengers.map((passenger) =>
      preparePassenger(passenger, this.stage.initialFloor),
    );
    this.waitingPassengers = {};

    for (let floor = 1; floor <= this.stage.floorCount; floor += 1) {
      this.waitingPassengers[floor] = clone(
        this.stage.waitingPassengers[floor] ?? [],
      );
    }

  }

  selectFloor(floor) {
    if (this.status !== "playing") return false;
    if (!Number.isInteger(floor)) return false;
    if (floor < 1 || floor > this.stage.floorCount) return false;
    if (floor === this.currentFloor) return false;

    this.selectedFloor = floor;
    return true;
  }

  move() {
    if (this.status !== "playing" || this.selectedFloor === null) {
      return [];
    }

    this.turn += 1;
    this.targetFloor = this.selectedFloor;
    const events = [
      {
        type: "depart",
        floor: this.currentFloor,
        targetFloor: this.targetFloor,
        message: `${this.currentFloor}F에서 ${this.targetFloor}F로 이동합니다.`,
      },
    ];

    while (this.status === "playing" && this.currentFloor !== this.targetFloor) {
      const nextFloor = this.findNextStop(this.targetFloor);
      const distance = Math.abs(nextFloor - this.currentFloor);
      const direction = Math.sign(nextFloor - this.currentFloor);

      for (
        let floor = this.currentFloor + direction;
        direction > 0 ? floor <= nextFloor : floor >= nextFloor;
        floor += direction
      ) {
        events.push({ type: "travel", floor });
      }

      this.currentFloor = nextFloor;
      events.push(...this.processStop(nextFloor, distance));
    }

    if (this.status === "playing") {
      events.push({
        type: "arrive",
        floor: this.currentFloor,
        message: `목표층 ${this.currentFloor}F에 도착했습니다.`,
      });
    }

    this.selectedFloor = null;
    this.targetFloor = null;
    return events;
  }

  beginMove() {
    if (this.status !== "playing" || this.selectedFloor === null) return [];

    this.turn += 1;
    this.targetFloor = this.selectedFloor;
    this.selectedFloor = null;
    this.routeActive = true;
    return this.advanceMove(true);
  }

  continueMove() {
    if (this.status !== "playing" || !this.routeActive || this.pendingStop) return [];
    return this.advanceMove(false);
  }

  advanceMove(includeDepart) {
    const events = [];
    if (includeDepart) {
      events.push({
        type: "depart",
        floor: this.currentFloor,
        targetFloor: this.targetFloor,
        message: `${this.currentFloor}F에서 ${this.targetFloor}F로 이동합니다.`,
      });
    }

    const nextFloor = this.findNextStop(this.targetFloor);
    const distance = Math.abs(nextFloor - this.currentFloor);
    const direction = Math.sign(nextFloor - this.currentFloor);

    for (
      let floor = this.currentFloor + direction;
      direction > 0 ? floor <= nextFloor : floor >= nextFloor;
      floor += direction
    ) {
      events.push({ type: "travel", floor });
    }

    this.currentFloor = nextFloor;
    this.pendingStop = { floor: nextFloor, distance, stage: "alight" };
    events.push({
      type: "stop",
      floor: nextFloor,
      distance,
      message: `${nextFloor}F에 정차했습니다. (${distance}층 이동)`,
    });

    return events;
  }

  resolveStopStep() {
    if (!this.pendingStop) return [];

    const { floor, distance } = this.pendingStop;
    if (this.pendingStop.stage === "alight") {
      const alighting = this.passengers.filter(
        (passenger) =>
          passenger.type === PASSENGER_TYPE.EMPLOYEE &&
          passenger.destinationFloor === floor,
      );
      const alightingIds = new Set(alighting.map((passenger) => passenger.id));
      this.passengers = this.passengers.filter(
        (passenger) => !alightingIds.has(passenger.id),
      );
      this.pendingStop.stage = "decrement";
      return alighting.length > 0
        ? [
            {
              type: "alight",
              floor,
              passengers: clone(alighting),
              message: `${alighting.map((passenger) => passenger.name).join(", ")} 하차`,
            },
          ]
        : [];
    }

    if (this.pendingStop.stage === "decrement") {
      const ceo = this.passengers.find(
        (passenger) => passenger.type === PASSENGER_TYPE.CEO,
      );
      if (floor === this.stage.ceoFloor && ceo && this.passengers.length === 1) {
        this.passengers = [];
        this.status = "clear";
        this.pendingStop = null;
        this.routeActive = false;
        this.targetFloor = null;
        return [
          {
            type: "clear",
            floor,
            message: "대표가 혼자 대표실에 도착했습니다. STAGE CLEAR!",
          },
        ];
      }

      const employees = this.passengers.filter(
        (passenger) => passenger.type === PASSENGER_TYPE.EMPLOYEE,
      );
      for (const employee of employees) {
        employee.remainingDistance -= distance;
      }
      const exhausted = employees.filter(
        (employee) => employee.remainingDistance <= 0,
      );
      this.pendingStop.stage = exhausted.length > 0 ? "done" : "board";

      if (exhausted.length > 0) {
        this.status = "game_over";
        this.pendingStop = null;
        this.routeActive = false;
        this.targetFloor = null;
        return [
          {
            type: "game_over",
            floor,
            passengers: clone(exhausted),
            message: `${exhausted.map((passenger) => passenger.name).join(", ")}의 상태가 바닥났습니다.`,
          },
        ];
      }

      return employees.length > 0
        ? [
            {
              type: "distance",
              floor,
              distance,
              passengers: clone(employees),
              message: `탑승 직원의 상태가 ${distance}만큼 감소했습니다.`,
            },
          ]
        : [];
    }

    if (this.pendingStop.stage === "board") {
      const events = [];
      if (floor !== this.stage.ceoFloor) {
        const availableSeats = this.stage.capacity - this.passengers.length;
        const waiting = this.waitingPassengers[floor];
        const boarding = waiting
          .splice(0, Math.max(0, availableSeats))
          .map((passenger) => preparePassenger(passenger, floor));
        if (boarding.length > 0) {
          this.passengers.push(...boarding);
          events.push({
            type: "board",
            floor,
            passengers: clone(boarding),
            message: `${boarding.map((passenger) => passenger.name).join(", ")} 탑승`,
          });
        }
      }
      this.pendingStop = null;
      if (this.currentFloor === this.targetFloor) {
        events.push({
          type: "arrive",
          floor: this.currentFloor,
          message: `목표층 ${this.currentFloor}F에 도착했습니다.`,
        });
        this.routeActive = false;
        this.targetFloor = null;
      }
      return events;
    }

    this.pendingStop = null;
    return [];
  }

  findNextStop(targetFloor) {
    const direction = Math.sign(targetFloor - this.currentFloor);

    for (
      let floor = this.currentFloor + direction;
      direction > 0 ? floor <= targetFloor : floor >= targetFloor;
      floor += direction
    ) {
      if (floor === targetFloor) return floor;

      const alightingCount = this.passengers.filter(
        (passenger) =>
          passenger.type === PASSENGER_TYPE.EMPLOYEE &&
          passenger.destinationFloor === floor,
      ).length;
      const seatsAfterAlighting =
        this.stage.capacity - (this.passengers.length - alightingCount);
      const hasWaitingPassengers = this.waitingPassengers[floor].length > 0;

      if (alightingCount > 0) return floor;
      if (
        floor !== this.stage.ceoFloor &&
        hasWaitingPassengers &&
        seatsAfterAlighting > 0
      ) {
        return floor;
      }
    }

    return targetFloor;
  }

  processStop(floor, distance) {
    const events = [
      {
        type: "stop",
        floor,
        distance,
        message: `${floor}F에 정차했습니다. (${distance}층 이동)`,
      },
    ];

    const alighting = this.passengers.filter(
      (passenger) =>
        passenger.type === PASSENGER_TYPE.EMPLOYEE &&
        passenger.destinationFloor === floor,
    );

    if (alighting.length > 0) {
      const alightingIds = new Set(alighting.map((passenger) => passenger.id));
      this.passengers = this.passengers.filter(
        (passenger) => !alightingIds.has(passenger.id),
      );
      events.push({
        type: "alight",
        floor,
        passengers: clone(alighting),
        message: `${alighting.map((passenger) => passenger.name).join(", ")} 하차`,
      });
    }

    const ceo = this.passengers.find(
      (passenger) => passenger.type === PASSENGER_TYPE.CEO,
    );
    if (floor === this.stage.ceoFloor && ceo && this.passengers.length === 1) {
      this.passengers = [];
      this.status = "clear";
      events.push({
        type: "clear",
        floor,
        message: "대표가 혼자 대표실에 도착했습니다. STAGE CLEAR!",
      });
      return events;
    }

    const employees = this.passengers.filter(
      (passenger) => passenger.type === PASSENGER_TYPE.EMPLOYEE,
    );
    for (const employee of employees) {
      employee.remainingDistance -= distance;
    }

    if (employees.length > 0) {
      events.push({
        type: "distance",
        floor,
        distance,
        passengers: clone(employees),
        message: `탑승 직원의 상태가 ${distance}만큼 감소했습니다.`,
      });
    }

    const exhausted = employees.filter(
      (employee) => employee.remainingDistance <= 0,
    );
    if (exhausted.length > 0) {
      this.status = "game_over";
      events.push({
        type: "game_over",
        floor,
        passengers: clone(exhausted),
        message: `${exhausted.map((employee) => employee.name).join(", ")}의 상태가 바닥났습니다.`,
      });
      return events;
    }

    if (floor !== this.stage.ceoFloor) {
      const availableSeats = this.stage.capacity - this.passengers.length;
      const waiting = this.waitingPassengers[floor];
      const boarding = waiting
        .splice(0, Math.max(0, availableSeats))
        .map((passenger) => preparePassenger(passenger, floor));

      if (boarding.length > 0) {
        this.passengers.push(...boarding);
        events.push({
          type: "board",
          floor,
          passengers: clone(boarding),
          message: `${boarding.map((passenger) => passenger.name).join(", ")} 탑승`,
        });
      }
    }

    return events;
  }

  getWaitingCount(floor) {
    return this.waitingPassengers[floor]?.length ?? 0;
  }
}


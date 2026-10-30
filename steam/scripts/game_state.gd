extends RefCounted
class_name ElevatorGameState

const STATUS_PLAYING := "playing"
const STATUS_CLEAR := "clear"
const STATUS_GAME_OVER := "game_over"
const TYPE_CEO := "ceo"
const TYPE_EMPLOYEE := "employee"

var status := STATUS_PLAYING
var current_floor := 1
var selected_floor: Variant = null
var target_floor: Variant = null
var route_active := false
var pending_stop: Variant = null
var turn := 0
var capacity := 3
var floor_count := 10
var ceo_floor := 10
var passengers: Array[Dictionary] = []
var waiting: Dictionary = {}

func _init() -> void:
	reset()

func reset() -> void:
	status = STATUS_PLAYING
	current_floor = 1
	selected_floor = null
	target_floor = null
	route_active = false
	pending_stop = null
	turn = 0
	passengers = [
		_prepare({"id": "ceo", "type": TYPE_CEO, "name": "대표", "destination": 10}, 1),
		_prepare({"id": "employee-a", "type": TYPE_EMPLOYEE, "name": "김대리", "destination": 3, "max_distance": 10}, 1),
	]
	waiting = {}
	for floor in range(1, floor_count + 1):
		waiting[floor] = []
	waiting[2] = [{"id": "employee-b", "type": TYPE_EMPLOYEE, "name": "박사원", "destination": 5, "max_distance": 8}]
	waiting[3] = [{"id": "employee-c", "type": TYPE_EMPLOYEE, "name": "이과장", "destination": 1, "max_distance": 8}]
	waiting[6] = [{"id": "employee-d", "type": TYPE_EMPLOYEE, "name": "최주임", "destination": 2, "max_distance": 5}]

func _prepare(passenger: Dictionary, boarding_floor: int) -> Dictionary:
	var result := passenger.duplicate(true)
	result["boarding_floor"] = boarding_floor
	if result["type"] == TYPE_EMPLOYEE:
		result["remaining"] = result["max_distance"]
	return result

func select_floor(floor: int) -> bool:
	if status != STATUS_PLAYING or floor == current_floor or floor < 1 or floor > floor_count:
		return false
	selected_floor = floor
	return true

func begin_move() -> Array[Dictionary]:
	if status != STATUS_PLAYING or selected_floor == null:
		return []
	turn += 1
	target_floor = selected_floor
	selected_floor = null
	route_active = true
	return _advance_move(true)

func continue_move() -> Array[Dictionary]:
	if status != STATUS_PLAYING or not route_active or pending_stop != null:
		return []
	return _advance_move(false)

func _advance_move(include_depart: bool) -> Array[Dictionary]:
	var events: Array[Dictionary] = []
	if include_depart:
		events.append({"type": "depart", "floor": current_floor, "target": target_floor})
	var next_floor := find_next_stop(target_floor)
	var direction := signi(next_floor - current_floor)
	var distance := absi(next_floor - current_floor)
	for floor in range(current_floor + direction, next_floor + direction, direction):
		events.append({"type": "travel", "floor": floor})
	current_floor = next_floor
	pending_stop = {"floor": next_floor, "distance": distance, "stage": "alight"}
	events.append({"type": "stop", "floor": next_floor})
	return events

func find_next_stop(target: int) -> int:
	var direction := signi(target - current_floor)
	for floor in range(current_floor + direction, target + direction, direction):
		if floor == target:
			return floor
		var alighting := 0
		for passenger in passengers:
			if passenger["type"] == TYPE_EMPLOYEE and passenger["destination"] == floor:
				alighting += 1
		var seats_after := capacity - (passengers.size() - alighting)
		if alighting > 0:
			return floor
		if floor != ceo_floor and not waiting[floor].is_empty() and seats_after > 0:
			return floor
	return target

func resolve_stop_step() -> Array[Dictionary]:
	if pending_stop == null:
		return []
	var floor: int = pending_stop["floor"]
	var distance: int = pending_stop["distance"]
	var stage: String = pending_stop["stage"]
	if stage == "alight":
		var alighting: Array[Dictionary] = []
		for passenger in passengers:
			if passenger["type"] == TYPE_EMPLOYEE and passenger["destination"] == floor:
				alighting.append(passenger)
		passengers = passengers.filter(func(passenger): return passenger not in alighting)
		pending_stop["stage"] = "decrement"
		return [{"type": "alight", "floor": floor, "passengers": alighting}] if not alighting.is_empty() else []
	if stage == "decrement":
		var ceo_exists := passengers.any(func(passenger): return passenger["type"] == TYPE_CEO)
		if floor == ceo_floor and ceo_exists and passengers.size() == 1:
			passengers.clear()
			status = STATUS_CLEAR
			route_active = false
			target_floor = null
			pending_stop = null
			return [{"type": "clear", "floor": floor}]
		var exhausted: Array[Dictionary] = []
		var employees: Array[Dictionary] = []
		for passenger in passengers:
			if passenger["type"] == TYPE_EMPLOYEE:
				passenger["remaining"] -= distance
				employees.append(passenger)
				if passenger["remaining"] <= 0:
					exhausted.append(passenger)
			if not exhausted.is_empty():
			status = STATUS_GAME_OVER
			route_active = false
			target_floor = null
			pending_stop = null
			return [{"type": "game_over", "floor": floor, "passengers": exhausted}]
		pending_stop["stage"] = "board"
		return [{"type": "distance", "floor": floor, "passengers": employees}] if not employees.is_empty() else []
	if stage == "board":
		var boarding: Array[Dictionary] = []
		if floor != ceo_floor:
			var seats := capacity - passengers.size()
			var source: Array = waiting[floor].slice(0, mini(seats, waiting[floor].size()))
			for passenger in source:
				boarding.append(_prepare(passenger, floor))
				waiting[floor].erase(passenger)
			passengers.append_array(boarding)
		pending_stop = null
		if current_floor == target_floor:
			route_active = false
			target_floor = null
		var events: Array[Dictionary] = []
		if not boarding.is_empty():
			events.append({"type": "board", "floor": floor, "passengers": boarding})
		return events
	return []

func waiting_count(floor: int) -> int:
	return waiting[floor].size()

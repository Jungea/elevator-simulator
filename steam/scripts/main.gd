extends Control

const FLOOR_TRAVEL_SECONDS := 1.2
const STOP_STEP_SECONDS := 0.14

var game := ElevatorGameState.new()
var visual_floor := 1
var is_animating := false
var is_stopping := false
var is_selecting_floor := true
var active_target: Variant = null
var travel_direction := 0

var floor_grid: GridContainer
var waiting_list: VBoxContainer
var passenger_grid: GridContainer
var floor_display: Label
var direction_label: Label
var close_button: Button
var capacity_label: Label
var status_label: Label
var result_label: Label
var direction_tween: Tween

func _ready() -> void:
	_build_ui()
	_render()

func _panel(title: String) -> VBoxContainer:
	var panel := VBoxContainer.new()
	panel.add_theme_constant_override("separation", 12)
	var heading := Label.new()
	heading.text = title
	heading.add_theme_font_size_override("font_size", 22)
	panel.add_child(heading)
	return panel

func _build_ui() -> void:
	var background := ColorRect.new()
	background.color = Color("#0a0d12")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)

	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_bottom", 24)
	add_child(margin)

	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 18)
	margin.add_child(columns)

	var waiting_panel := _panel("대기 직원")
	waiting_panel.custom_minimum_size = Vector2(245, 0)
	waiting_list = VBoxContainer.new()
	waiting_panel.add_child(waiting_list)
	columns.add_child(waiting_panel)

	var elevator_panel := _panel("탑승자")
	elevator_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var elevator_header := HBoxContainer.new()
	floor_display = Label.new()
	floor_display.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	floor_display.add_theme_font_size_override("font_size", 72)
	floor_display.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	elevator_header.add_child(floor_display)
	direction_label = Label.new()
	direction_label.add_theme_font_size_override("font_size", 52)
	elevator_header.add_child(direction_label)
	elevator_panel.add_child(elevator_header)
	capacity_label = Label.new()
	elevator_panel.add_child(capacity_label)
	passenger_grid = GridContainer.new()
	passenger_grid.columns = 3
	passenger_grid.add_theme_constant_override("h_separation", 8)
	passenger_grid.add_theme_constant_override("v_separation", 8)
	elevator_panel.add_child(passenger_grid)
	columns.add_child(elevator_panel)

	var control_panel := _panel("층 버튼")
	control_panel.custom_minimum_size = Vector2(260, 0)
	floor_grid = GridContainer.new()
	floor_grid.columns = 2
	floor_grid.add_theme_constant_override("h_separation", 10)
	floor_grid.add_theme_constant_override("v_separation", 10)
	control_panel.add_child(floor_grid)
	close_button = Button.new()
	close_button.text = "‹  |  ›"
	close_button.custom_minimum_size = Vector2(0, 74)
	close_button.pressed.connect(_on_close_pressed)
	control_panel.add_child(close_button)
	status_label = Label.new()
	control_panel.add_child(status_label)
	columns.add_child(control_panel)

	result_label = Label.new()
	result_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	result_label.add_theme_font_size_override("font_size", 24)
	result_label.position = Vector2(0, 10)
	result_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	add_child(result_label)

func _render() -> void:
	_render_floors()
	_render_waiting()
	_render_passengers()
	floor_display.text = "%02d" % visual_floor
	capacity_label.text = "%d / %d" % [game.passengers.size(), game.capacity]
	var has_direction := is_animating and travel_direction != 0 and not (is_stopping and game.pending_stop != null and game.current_floor == game.target_floor)
	direction_label.text = "↑" if travel_direction > 0 else "↓" if travel_direction < 0 else ""
	direction_label.visible = has_direction
	direction_label.modulate = Color("#ff647c")
	if direction_tween and direction_tween.is_valid():
		direction_tween.kill()
	direction_tween = null
	if has_direction and not is_stopping:
		direction_label.modulate.a = 1.0
		direction_tween = create_tween().set_loops()
		direction_tween.tween_property(direction_label, "modulate:a", 0.25, 0.36)
		direction_tween.tween_property(direction_label, "modulate:a", 1.0, 0.36)
	close_button.disabled = game.status != ElevatorGameState.STATUS_PLAYING or (is_animating and not is_stopping) or (not is_stopping and game.selected_floor == null)
	close_button.modulate = Color("#ffffff") if is_stopping or game.selected_floor != null else Color("#687382")
	status_label.text = "운행 중" if is_animating else "대기 중"
	if game.status == ElevatorGameState.STATUS_CLEAR:
		result_label.text = "대표님이 무사히 출근했어요!"
	elif game.status == ElevatorGameState.STATUS_GAME_OVER:
		result_label.text = "산업 스파이!\n직원은 대표실에 들어오면 안 됩니다." if game.failure_reason == "ceo_office_infiltration" else "월급루팡!\n남은 층수 안에 직원을 목표 층수로 이동시켜야 합니다."
	else:
		result_label.text = ""

func _render_floors() -> void:
	for child in floor_grid.get_children():
		child.queue_free()
	var order: Array[int] = []
	var left_column: Array[int] = [4, 3, 2, 1, -1, -2]
	var right_column: Array[int] = [10, 9, 8, 7, 6, 5]
	for row in range(6):
		if left_column[row] >= game.min_floor and left_column[row] <= game.floor_count:
			order.append(left_column[row])
		if right_column[row] >= game.min_floor and right_column[row] <= game.floor_count:
			order.append(right_column[row])
	for floor in order:
		var button := Button.new()
		button.text = "%d" % floor if floor > 0 else "B%d" % absi(floor)
		button.custom_minimum_size = Vector2(92, 76)
		var is_moving_target := is_animating and floor == active_target
		var is_current := is_moving_target or (not is_animating and floor == game.current_floor)
		var is_available := is_selecting_floor and game.selected_floor == null and floor != game.current_floor
		button.disabled = floor == game.current_floor or game.status != ElevatorGameState.STATUS_PLAYING or is_animating
		if is_current:
			button.modulate = Color("#ff647c")
		elif is_available:
			button.modulate = Color("#ffffff")
		elif floor == game.selected_floor and not is_moving_target:
			button.modulate = Color("#ffcc4d")
		else:
			button.modulate = Color("#cdd4de")
		button.pressed.connect(_on_floor_pressed.bind(floor))
		floor_grid.add_child(button)

func _render_waiting() -> void:
	for child in waiting_list.get_children():
		child.queue_free()
	for floor in range(game.floor_count, game.min_floor - 1, -1):
		if floor == 0:
			continue
		var label := Label.new()
		var floor_name := "%dF" % floor if floor > 0 else "B%d" % absi(floor)
		label.text = "%s    %d명" % [floor_name, game.waiting_count(floor)] if floor != game.ceo_floor else "%s    대표실" % floor_name
		waiting_list.add_child(label)

func _render_passengers() -> void:
	for child in passenger_grid.get_children():
		child.queue_free()
	for passenger in game.passengers:
		var card := VBoxContainer.new()
		card.custom_minimum_size = Vector2(110, 150)
		var avatar := Label.new()
		avatar.text = "🧑‍💼" if passenger["type"] == ElevatorGameState.TYPE_EMPLOYEE else "👑"
		avatar.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		avatar.add_theme_font_size_override("font_size", 38)
		card.add_child(avatar)
		var name := Label.new()
		name.text = passenger["name"]
		name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		card.add_child(name)
		var destination := Label.new()
		destination.text = "%dF" % passenger["destination"]
		destination.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		card.add_child(destination)
		if passenger["type"] == ElevatorGameState.TYPE_EMPLOYEE:
			var state := Label.new()
			state.text = "%d / %d" % [passenger["remaining"], passenger["max_distance"]]
			state.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			card.add_child(state)
		passenger_grid.add_child(card)

func _on_floor_pressed(floor: int) -> void:
	if game.select_floor(floor):
		_render()

func _on_close_pressed() -> void:
	if is_stopping:
		is_stopping = false
		if not game.route_active:
			is_animating = false
			is_selecting_floor = true
			active_target = null
			_render()
			return
		var next_events := game.continue_move()
		await _animate_segment(next_events)
		return
	if is_animating or game.selected_floor == null:
		return
	active_target = game.selected_floor
	is_selecting_floor = false
	travel_direction = signi(active_target - game.current_floor)
	await _animate_segment(game.begin_move())

func _animate_segment(events: Array[Dictionary]) -> void:
	is_animating = true
	_render()
	for event in events:
		if event["type"] == "travel":
			visual_floor = event["floor"]
			_render()
			await get_tree().create_timer(FLOOR_TRAVEL_SECONDS).timeout
		elif event["type"] == "stop":
			visual_floor = event["floor"]
			_render()
			is_stopping = false
			while game.pending_stop != null:
				game.resolve_stop_step()
				_render()
				await get_tree().create_timer(STOP_STEP_SECONDS).timeout
			if game.route_active and game.status == ElevatorGameState.STATUS_PLAYING:
				is_stopping = true
				_render()
			break
	if not game.route_active or game.status != ElevatorGameState.STATUS_PLAYING:
		is_animating = false
		is_stopping = false
		is_selecting_floor = game.status == ElevatorGameState.STATUS_PLAYING
		active_target = null
		_render()

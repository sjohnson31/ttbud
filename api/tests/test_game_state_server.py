from src.game_state_server import GameStateServer, Token


test_token = {
    'id': 'valid-id',
    'icon_id': 'valid_icon_id',
    'start_x': 0,
    'start_y': 0,
    'start_z': 0,
    'end_x': 1,
    'end_y': 1,
    'end_z': 1,
}


def test_validate_token():
    valid_token = Token(**test_token)
    assert GameStateServer.is_valid_token(valid_token) is True

    invalid_token = Token(**test_token)
    invalid_token.start_x = 2
    assert GameStateServer.is_valid_token(invalid_token) is False


def test_get_unit_blocks():
    valid_token = Token(**test_token)
    assert GameStateServer.get_unit_blocks(valid_token) == [(0, 0, 0)]

    valid_token.end_x = 2
    valid_token.end_y = 2
    valid_token.end_z = 2
    blocks = GameStateServer.get_unit_blocks(valid_token)
    assert (0, 0, 0) in blocks
    assert (1, 0, 0) in blocks
    assert (0, 1, 0) in blocks
    assert (0, 0, 1) in blocks
    assert (1, 1, 0) in blocks
    assert (1, 0, 1) in blocks
    assert (0, 1, 1) in blocks
    assert (1, 1, 1) in blocks

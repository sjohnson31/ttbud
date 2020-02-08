import pytest

from game_state_server import GameStateServer, MessageError, Token
from room_store import MemoryRoomStore


TEST_ROOM_ID = 'test_room'
TEST_CLIENT = 'test_client'
valid_data = {
    'id': 'some_id',
    'icon_id': 'some_icon_id',
    'start_x': 0,
    'start_y': 0,
    'start_z': 0,
    'end_x': 1,
    'end_y': 1,
    'end_z': 1,
}
valid_update = {'action': 'create', 'data': valid_data}


@pytest.fixture
def gss():
    rs = MemoryRoomStore('/my/path/to/room/storage/')
    return GameStateServer(rs)


@pytest.fixture
def gss_with_client():
    rs = MemoryRoomStore('/my/path/to/room/storage/')
    gss = GameStateServer(rs)
    gss.new_connection_request(TEST_CLIENT, TEST_ROOM_ID)
    return gss


def test_new_connection(gss):
    reply = gss.new_connection_request('test_client', 'room1')
    assert reply.type == 'state'
    assert len(reply.data) == 0


def test_room_does_not_exist(gss):
    with pytest.raises(MessageError):
        gss.process_update({}, 'room id that does not exist')


def test_room_data_is_stored(gss_with_client):
    gss_with_client.process_update(valid_update, TEST_ROOM_ID)
    gss_with_client.connection_dropped(TEST_CLIENT, TEST_ROOM_ID)
    stored_data = gss_with_client.room_store.read_room_data(TEST_ROOM_ID)
    assert stored_data.get(valid_data['id'], False)
    assert stored_data[valid_data['id']] == valid_data


def test_duplicate_update_rejected(gss_with_client):
    gss_with_client.process_update(valid_update, TEST_ROOM_ID)
    with pytest.raises(MessageError):
        gss_with_client.process_update(valid_update, TEST_ROOM_ID)


def test_duplicate_update_in_different_room(gss):
    gss.new_connection_request('client1', 'room1')
    gss.new_connection_request('client2', 'room2')
    reply1 = gss.process_update(valid_update, 'room1')
    reply2 = gss.process_update(valid_update, 'room2')
    assert reply1.data == [valid_data]
    assert reply2.data == [valid_data]


def test_delete_token(gss_with_client):
    gss_with_client.process_update(valid_update, TEST_ROOM_ID)
    reply = gss_with_client.process_update(
        {'action': 'delete', 'data': valid_data['id']}, TEST_ROOM_ID
    )
    assert len(reply.data) == 0


def test_delete_non_existent_token(gss_with_client):
    with pytest.raises(MessageError):
        gss_with_client.process_update(
            {'action': 'delete', 'data': valid_data['id']}, TEST_ROOM_ID
        )


def test_delete_after_load(gss_with_client):
    gss_with_client.process_update(valid_update, TEST_ROOM_ID)
    gss_with_client.connection_dropped(TEST_CLIENT, TEST_ROOM_ID)
    gss_with_client.new_connection_request(TEST_CLIENT, TEST_ROOM_ID)
    reply = gss_with_client.process_update(
        {'action': 'delete', 'data': valid_data['id']}, TEST_ROOM_ID,
    )
    assert len(reply.data) == 0


def test_move_existing_token(gss_with_client):
    gss_with_client.process_update(valid_update, TEST_ROOM_ID)
    updated_token = {
        'id': valid_data['id'],
        'icon_id': valid_data['icon_id'],
        'start_x': 7,
        'start_y': 8,
        'start_z': 9,
        'end_x': 8,
        'end_y': 9,
        'end_z': 10,
    }
    reply = gss_with_client.process_update(
        {'action': 'update', 'data': updated_token}, TEST_ROOM_ID
    )
    assert len(reply.data) == 1
    assert reply.data[0] == updated_token


def test_ping(gss_with_client):
    valid_ping = {'key': 'some_id', 'x': 4, 'y': 4}
    reply = gss_with_client.process_update(
        {'action': 'ping', 'data': valid_ping}, TEST_ROOM_ID
    )
    assert reply.type == 'ping'
    assert reply.data == valid_ping


def test_invalid_action(gss_with_client):
    with pytest.raises(MessageError):
        gss_with_client.process_update(
            {'action': 'destroy all humans', 'data': valid_data}, TEST_ROOM_ID
        )


def test_invalid_data(gss_with_client):
    with pytest.raises(MessageError):
        gss_with_client.process_update(
            {'action': 'create', 'data': 'destroy all humans'}, TEST_ROOM_ID
        )


def test_incomplete_message(gss_with_client):
    with pytest.raises(MessageError):
        gss_with_client.process_update({'action': 'create'}, TEST_ROOM_ID)
    with pytest.raises(MessageError):
        gss_with_client.process_update({'data': valid_data}, TEST_ROOM_ID)


def test_delete_with_full_token(gss_with_client):
    gss_with_client.process_update(valid_update, TEST_ROOM_ID)
    with pytest.raises(MessageError):
        gss_with_client.process_update(
            {'action': 'delete', 'data': valid_data}, TEST_ROOM_ID
        )

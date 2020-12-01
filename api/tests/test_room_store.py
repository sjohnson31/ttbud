import asyncio
from asyncio import Future
from typing import List, Union, Callable, Awaitable

import fakeredis.aioredis
import pytest

from src.util.async_collect import async_collect
from src.game_components import Ping, Token
from src.game_state_server import BareUpdateResult
from src.room_store.room_store import (
    RoomStore,
    TransactionFailed,
    MutationResult,
    LOCK_EXPIRATION_SECS,
)

from src.room_store.memory_room_store import (
    MemoryRoomStore,
    MemoryRoomStorage,
)

from src.room_store.redis_room_store import create_redis_room_store

from tests.static_fixtures import VALID_TOKEN, ANOTHER_VALID_TOKEN, VALID_PING


# If we don't depend on event_loop (even though it isn't explicitly used), then it
# won't be set up early enough for create_redis_pool to find it, and tests and redis
# will get two different event loops that will deadlock waiting for each other
@pytest.fixture
async def redis(event_loop):
    redis_instance = await fakeredis.aioredis.create_redis_pool()
    yield redis_instance
    redis_instance.close()
    await redis_instance.wait_closed()


@pytest.fixture
def redis_room_store_factory(redis):
    return lambda: create_redis_room_store(redis)


@pytest.fixture
async def redis_room_store(redis_room_store_factory):
    return await redis_room_store_factory()


@pytest.fixture
def memory_room_storage():
    return MemoryRoomStorage()


@pytest.fixture
def memory_room_store_factory(memory_room_storage):
    async def fn():
        return MemoryRoomStore(memory_room_storage)

    return fn


@pytest.fixture
async def memory_room_store(memory_room_store_factory):
    return await memory_room_store_factory()


async def mutate_to(entities: List[Union[Ping, Token]]) -> MutationResult:
    return BareUpdateResult(entities)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store',
    [pytest.lazy_fixture('memory_room_store'), pytest.lazy_fixture('redis_room_store')],
)
async def test_mutate_and_read(room_store: RoomStore, mocker):
    mocker.patch('time.time', return_value=0)
    result = await room_store.apply_mutation(
        'room_id', lambda _: mutate_to([VALID_TOKEN, VALID_PING])
    )
    assert result.entities == [VALID_TOKEN, VALID_PING]
    assert (await room_store.read('room_id')) == [VALID_TOKEN, VALID_PING]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store',
    [pytest.lazy_fixture('memory_room_store'), pytest.lazy_fixture('redis_room_store')],
)
async def test_list_all_keys(room_store: RoomStore):
    await room_store.apply_mutation('room-id-1', lambda _: mutate_to([]))
    await room_store.apply_mutation('room-id-2', lambda _: mutate_to([]))

    assert (await async_collect(room_store.get_all_room_ids())) == [
        'room-id-1',
        'room-id-2',
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store_factory',
    [
        pytest.lazy_fixture('memory_room_store_factory'),
        pytest.lazy_fixture('redis_room_store_factory'),
    ],
)
async def test_transaction_contention(
    room_store_factory: Callable[[], Awaitable[RoomStore]]
):
    room_store_1 = await room_store_factory()
    room_store_2 = await room_store_factory()

    first_transaction_mutate: Future = Future()
    first_transaction_task = asyncio.create_task(
        room_store_1.apply_mutation('room-id-1', lambda _: first_transaction_mutate)
    )
    # Have to yield to the event loop here to get the above task to run up
    # until it waits for our mutate function to complete
    await asyncio.sleep(0)

    # Now that room_store_1 has started the transaction, but is stuck waiting for our
    # mutate function to complete it, attempts to make changes to the same room
    # should fail
    with pytest.raises(TransactionFailed):
        await room_store_2.apply_mutation(
            'room-id-1', lambda _: mutate_to([ANOTHER_VALID_TOKEN])
        )

    # Finish the original transaction, which should succeed
    first_transaction_mutate.set_result(await mutate_to([VALID_TOKEN]))
    await first_transaction_task

    assert await room_store_1.read('room-id-1') == [VALID_TOKEN]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store',
    [pytest.lazy_fixture('memory_room_store'), pytest.lazy_fixture('redis_room_store')],
)
async def test_lock_expiration(room_store: RoomStore, mocker):
    mocker.patch('time.time', return_value=0)
    first_transaction_mutate: Future = Future()
    first_transaction_task = asyncio.create_task(
        room_store.apply_mutation('room-id', lambda _: first_transaction_mutate)
    )

    # Have to yield to the event loop here to get the above task to run up
    # until it waits for our mutate function to complete
    await asyncio.sleep(0)

    mocker.patch('time.time', return_value=LOCK_EXPIRATION_SECS + 1)
    first_transaction_mutate.set_result(await mutate_to([VALID_TOKEN]))
    # Transaction should fail because the mutate function took too long
    with pytest.raises(TransactionFailed):
        await first_transaction_task

    # No changes should be made to the room
    assert await room_store.read('room-id') is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'room_store',
    [pytest.lazy_fixture('memory_room_store'), pytest.lazy_fixture('redis_room_store')],
)
async def test_exception_in_mutate(room_store: RoomStore):
    async def failed_mutate(_):
        raise Exception('Mutate failed')

    with pytest.raises(Exception):
        await room_store.apply_mutation('room-id', failed_mutate)

    # Lock should be released at this point, since the mutation failed
    await room_store.apply_mutation('room-id', lambda _: mutate_to([VALID_TOKEN]))
    assert await room_store.read('room-id') == [VALID_TOKEN]

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import (
    AsyncIterator,
    Callable,
    ContextManager,
    List,
    AsyncIterable,
    Dict,
    DefaultDict,
)
from uuid import uuid4

import timber

from src.api.api_structures import (
    Response,
    DeleteAction,
    Request,
    ErrorResponse,
    StateResponse,
    ConnectionResponse,
)
from src.api.ws_close_codes import ERR_TOO_MANY_ROOMS_CREATED, ERR_INVALID_ROOM
from src.util.assert_never import assert_never
from .rate_limit.rate_limit import RateLimiter, TooManyRoomsCreatedException
from .room import Room, create_room
from .room_store.room_store import RoomStore
from .util.async_util import items_until

logger = logging.getLogger(__name__)

MAX_UPDATE_RETRIES = 3
PING_LENGTH_SECS = 3


class InvalidConnectionException(Exception):
    close_code: int
    reason: str

    def __init__(self, close_code: int, reason: str):
        self.close_code = close_code
        self.reason = reason


@dataclass
class ChangeListener:
    output_queues: List[asyncio.Queue[Response]]
    task: asyncio.Task


@dataclass
class RoomContext:
    room: Room
    change_listener: ChangeListener


class GameStateServer:
    def __init__(
        self,
        room_store: RoomStore,
        apm_transaction: Callable[[str], ContextManager],
        rate_limiter: RateLimiter,
    ):
        self.room_store = room_store
        self.apm_transaction = apm_transaction
        self._rate_limiter = rate_limiter
        self._room_context_by_id: Dict[str, RoomContext] = {}
        self._room_occupancy: DefaultDict[str, int] = defaultdict(lambda: 0)

    async def _listen_for_changes(self, room_id: str, session_id: str) -> None:
        listener = self._room_context_by_id[room_id].change_listener
        queues = listener.output_queues
        requests = await self.room_store.changes(room_id)
        async for response in self._room_changes_to_messages(
            room_id, session_id, requests
        ):
            for q in queues:
                await q.put(response)

    async def _process_requests(
        self, room_id: str, requests: AsyncIterator, stop_fut: asyncio.Future
    ) -> None:
        try:
            async for request in requests:
                await self.room_store.add_update(room_id, request)
        finally:
            stop_fut.set_result(None)

    async def handle_connection(
        self, room_id: str, client_ip: str, requests: AsyncIterator[Request]
    ) -> AsyncIterable[Response]:
        """Handle a new client connection
        :param client_ip: IP address of the client
        :param room_id: The UUID that identifies the room the client
        is trying to connect to
        :param requests: The stream of requests from the connection
        :raise InvalidConnectionException: If the client connection should be rejected
        """
        session_id = str(uuid4())
        with timber.context(connection={'session_id': session_id, 'room_id': room_id}):
            async with self._rate_limiter.rate_limited_connection(client_ip, room_id):
                listener_q: asyncio.Queue[Response] = asyncio.Queue()

                with self.apm_transaction('connect'):
                    if not self._room_context_by_id.get(room_id):
                        await self._acquire_room_slot(room_id, client_ip)
                        room = create_room(room_id, await self.room_store.read(room_id))
                        change_listener = ChangeListener(
                            [],
                            asyncio.create_task(
                                self._listen_for_changes(room_id, session_id)
                            ),
                        )
                        self._room_context_by_id[room_id] = RoomContext(
                            room, change_listener
                        )
                    self._room_context_by_id[
                        room_id
                    ].change_listener.output_queues.append(listener_q)

                    room_state = list(
                        self._room_context_by_id[room_id].room.game_state.values()
                    )
                    yield ConnectionResponse(room_state)

                self._room_occupancy[room_id] += 1
                try:
                    stop_fut: asyncio.Future = asyncio.Future()
                    request_task = asyncio.create_task(
                        self._process_requests(room_id, requests, stop_fut)
                    )
                    async for msg in items_until(listener_q, stop_fut):
                        yield msg
                finally:
                    request_task.cancel()
                    self._room_occupancy[room_id] -= 1
                    if self._room_occupancy[room_id] <= 0:
                        del self._room_occupancy[room_id]
                        self._room_context_by_id[room_id].change_listener.task.cancel()

    async def _room_changes_to_messages(
        self,
        room_id: str,
        session_id: str,
        room_changes: AsyncIterator[Request],
    ) -> AsyncIterator[Response]:
        async for request in room_changes:
            if request.request_id:
                # Just wrap the the initial response behind a transaction, otherwise
                # each request with a ping will always take three seconds because
                # we just sleep before sending the final message
                with self.apm_transaction('update'):
                    room_context = self._room_context_by_id.get(room_id)
                    if not room_context:
                        raise InvalidConnectionException(
                            ERR_INVALID_ROOM,
                            f'Tried to update room {room_id}, which does not exist',
                        )
                    room = room_context.room

                    for update in request.updates:
                        if update.action == 'create' or update.action == 'update':
                            token = update.data
                            if room.is_valid_position(token):
                                room.create_or_update_token(token)
                            else:
                                logger.info(
                                    f'Token {token.id} cannot move to occupied position'
                                )
                                yield ErrorResponse(
                                    'That position is occupied, bucko',
                                    request.request_id,
                                    session_id,
                                )
                        elif update.action == 'delete':
                            if room.game_state.get(update.data, False):
                                room.delete_token(update.data)
                            else:
                                yield ErrorResponse(
                                    'Cannot delete token because it does not exist',
                                    request.request_id,
                                    session_id,
                                )
                        elif update.action == 'ping':
                            room.create_ping(update.data)
                            asyncio.create_task(
                                self._expire_ping(
                                    room_id, request.request_id, update.data.id
                                )
                            )
                        else:
                            assert_never(update)
                    yield StateResponse(
                        list(room.game_state.values()), request.request_id
                    )

    async def _expire_ping(self, room_id: str, request_id: str, ping_id: str) -> None:
        await asyncio.sleep(PING_LENGTH_SECS)
        delete_ping_action = DeleteAction('delete', ping_id)
        await self.room_store.add_update(
            room_id, Request(request_id, [delete_ping_action])
        )

    async def _acquire_room_slot(self, room_id: str, client_ip: str) -> None:
        try:
            await self._rate_limiter.acquire_new_room(client_ip)
        except TooManyRoomsCreatedException:
            logger.info(
                f'Rejecting connection to {client_ip}, too many rooms'
                ' created recently',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            raise InvalidConnectionException(
                ERR_TOO_MANY_ROOMS_CREATED,
                'Too many rooms created by client',
            )

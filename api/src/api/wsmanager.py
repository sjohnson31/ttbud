import asyncio
import json
import logging
import random
from dataclasses import asdict
from typing import List, Tuple, Dict, Any, NoReturn, AsyncIterator
from uuid import UUID

import dacite
from dacite.exceptions import WrongTypeError, MissingValueError
from websockets import ConnectionClosedError

from src.api.api_structures import Request
from src.api.ws_close_codes import (
    ERR_INVALID_UUID,
    ERR_TOO_MANY_CONNECTIONS,
    ERR_ROOM_FULL,
    ERR_INVALID_REQUEST,
)
from src.game_state_server import (
    InvalidConnectionException,
    GameStateServer,
)
from src.rate_limit.rate_limit import (
    RateLimiter,
    SERVER_LIVENESS_EXPIRATION_SECONDS,
    TooManyConnectionsException,
    RoomFullException,
)
from src.ws.ws_client import WebsocketClient

logger = logging.getLogger(__name__)


class InvalidRequestException(Exception):
    ...


def ignore_none(items: List[Tuple[str, Any]]) -> Dict[str, Any]:
    return dict(filter(lambda entry: entry[1] is not None, items))


def is_valid_uuid(uuid_string: str) -> bool:
    try:
        val = UUID(uuid_string, version=4)
    except ValueError:
        return False
    return val.hex == uuid_string.replace('-', '')


async def _requests(client: WebsocketClient) -> AsyncIterator[Request]:
    async for raw_message in client.requests():
        try:
            message = json.loads(raw_message)
            request = dacite.from_dict(Request, message)
        except (json.JSONDecodeError, WrongTypeError, MissingValueError):
            logger.info(
                'invalid json received from client',
                extra={'json': raw_message},
                exc_info=True,
            )
            raise InvalidRequestException()

        yield Request(
            updates=request.updates,
            request_id=request.request_id,
        )


class WebsocketManager:
    def __init__(self, gss: GameStateServer, rate_limiter: RateLimiter) -> None:
        self._gss = gss
        self._rate_limiter = rate_limiter
        self._clients: List[WebsocketClient] = []

    async def maintain_liveness(self) -> NoReturn:
        while True:
            logger.info('Refreshing liveness')

            ips = [client.ip() for client in self._clients]
            await self._rate_limiter.refresh_server_liveness(iter(ips))

            # Offset refresh interval by a random amount to avoid all hitting
            # redis to refresh keys at the same time.
            # These numbers were chosen by the scientific process of making it up
            max_refresh_offset = SERVER_LIVENESS_EXPIRATION_SECONDS / 16
            refresh_offset = random.uniform(-max_refresh_offset, max_refresh_offset)

            # Leave plenty of wiggle room so that we can't miss our refresh
            # target just by being overloaded
            await asyncio.sleep(
                (SERVER_LIVENESS_EXPIRATION_SECONDS / 3) + refresh_offset
            )

    async def connection_handler(self, client: WebsocketClient) -> None:
        room_id = client.path().lstrip('/')
        if not is_valid_uuid(room_id):
            logger.info(f'Invalid room UUID: {room_id}')
            await client.close(code=ERR_INVALID_UUID)
            return

        await client.accept()

        self._clients.append(client)

        client_ip = client.ip()
        try:
            async for response in self._gss.handle_connection(
                room_id, client_ip, _requests(client)
            ):
                await client.send(
                    json.dumps(asdict(response, dict_factory=ignore_none))
                )
        except InvalidRequestException:
            logger.info(
                f'Closing connection to {client_ip}, invalid request received',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(ERR_INVALID_REQUEST)
        except TooManyConnectionsException:
            logger.info(
                f'Rejecting connection to {client_ip}, too many connections for user',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(ERR_TOO_MANY_CONNECTIONS)
        except RoomFullException:
            logger.info(
                f'Rejecting connection to {client_ip}, room is full',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(ERR_ROOM_FULL)
        except InvalidConnectionException as e:
            logger.info(
                f'Rejecting connection to {client_ip}, {e.reason}',
                extra={'client_ip': client_ip, 'room_id': room_id},
            )
            await client.close(e.close_code)
        except ConnectionClosedError:
            # Disconnecting is a perfectly normal thing to happen, so just
            # continue cleaning up connection state
            pass

        self._clients.remove(client)

import logging
import asyncio
import json
from dataclasses import asdict
from typing import Union, List, Tuple, Dict, Any
from uuid import UUID

import websockets

from .game_state_server import Message, MessageContents, InvalidConnectionException
from .ws_close_codes import ERR_INVALID_UUID


def ignore_none(items: List[Tuple[str, Any]]) -> Dict[str, Any]:
    return dict(filter(lambda entry: entry[1] is not None, items))


def is_valid_uuid(uuid_string):
    try:
        val = UUID(uuid_string, version=4)
    except ValueError:
        return False
    return val.hex == uuid_string.replace('-', '')


logger = logging.getLogger(__name__)


class WebsocketManager:
    def __init__(self, port, gss):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.port = port
        self.gss = gss
        self._client_ids = {}

    def start_server(self) -> None:
        try:
            ws_server = websockets.serve(self.consumer_handler, '0.0.0.0', self.port,)
            self._loop.run_until_complete(ws_server)
        except OSError as e:
            logger.exception('Failed to start websocket server', exc_info=e)
        else:
            self._loop.run_forever()

    async def consumer_handler(
        self, client: websockets.WebSocketServerProtocol, room_id: str
    ) -> None:
        room_id = room_id.lstrip('/')
        if not is_valid_uuid(room_id):
            logger.info(f'Invalid room UUID: {room_id}')
            await client.close(
                code=ERR_INVALID_UUID, reason=f'Invalid room UUID: {room_id}'
            )
            return

        self._client_ids[hash(client)] = client
        try:
            response = self.gss.new_connection_request(hash(client), room_id)
        except InvalidConnectionException as e:
            await client.close(e.close_code, e.reason)
            return

        await self.send_message(response)
        try:
            async for message in client:
                asyncio.ensure_future(self.consume(message, room_id, client))
        finally:
            self.gss.connection_dropped(hash(client), room_id)

    async def send_message(self, message: Message) -> None:
        for target in message.targets:
            client = self._client_ids.get(target)
            if client:
                await client.send(
                    json.dumps(asdict(message.contents, dict_factory=ignore_none))
                )
            else:
                logger.info(
                    f'Cannot send message to target: {target} because it does not exist'
                )

    async def consume(
        self,
        json_message: Union[str, bytes],
        room_id: str,
        client: websockets.WebSocketServerProtocol,
    ) -> None:
        try:
            message = json.loads(json_message)
        except json.JSONDecodeError as e:
            logger.info('invalid json received from client', exc_info=e)
            return
        updates = message['updates']

        try:
            async for reply in self.gss.process_updates(
                updates, room_id, hash(client), message['request_id']
            ):
                await self.send_message(reply)
        except Exception as err:
            logger.exception('Failed to process updates', exc_info=err)
            await self.send_message(
                Message(
                    [hash(client)],
                    MessageContents(
                        'error', 'Something went wrong', message['request_id']
                    ),
                )
            )


def start_websocket(host_port, room_store_dir):
    ws = WebsocketManager(host_port, room_store_dir)
    ws.start_server()

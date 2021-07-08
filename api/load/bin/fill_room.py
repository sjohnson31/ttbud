# Fill a room to test perf for full rooms

import asyncio
import itertools
from uuid import uuid4

from src.api.api_structures import Request, UpsertAction
from src.config import config
from src.game_components import Token, TextTokenContents
from src.redis import create_redis_pool
from src.room_store.redis_room_store import create_redis_room_store


def make_floor(x, y):
    return UpsertAction(Token(
        id=str(uuid4()),
        type="floor",
        contents=TextTokenContents("QQ"),
        start_x=x,
        start_y=y,
        start_z=0,
        end_x=x + 1,
        end_y=y + 1,
        end_z=1))


async def main() -> None:
    redis = await create_redis_pool(config.redis_address, config.redis_ssl_validation)
    room_store = await create_redis_room_store(redis)
    actions = [make_floor(x, y) for x, y in itertools.product(range(100), repeat=2)]
    await room_store.add_request(Request(
        request_id=str(uuid4()),
        actions=actions
    ))


if __name__ == "__main__":
    asyncio.run(main())

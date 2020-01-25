import os
import json


class RoomStore:
    def __init__(self, room_store_dir):
        self.path = room_store_dir
        os.makedirs(self.path, exist_ok=True)

    def get_all_room_ids(self) -> list:
        return os.listdir(self.path)

    def _is_valid_path(self, full_path: str) -> bool:
        return os.path.abspath(full_path).startswith(self.path)

    def write_room_data(self, room_id: str, data: dict):
        full_path = f'{self.path}/{room_id}'
        if self._is_valid_path(full_path):
            with open(full_path, 'w') as f:
                f.write(json.dumps(data))

    def read_room_data(self, room_id: str) -> dict:
        full_path = f'{self.path}/{room_id}'
        if self._is_valid_path(full_path):
            with open(full_path, 'r') as f:
                return json.loads(f.read())

    def room_data_exists(self, room_id: str) -> bool:
        return os.path.exists(f'{self.path}/{room_id}')

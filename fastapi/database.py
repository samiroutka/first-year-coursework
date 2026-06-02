import json
import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent / "parking.db"


def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS app_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                settings TEXT NOT NULL,
                time INTEGER NOT NULL,
                queue TEXT NOT NULL,
                history TEXT NOT NULL,
                next_car_id INTEGER NOT NULL
            )
        """)


def load_state():
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT settings, time, queue, history, next_car_id
            FROM app_state
            WHERE id = 1
            """
        ).fetchone()

    if row is None:
        return None

    return {
        "settings": json.loads(row[0]),
        "time": row[1],
        "queue": json.loads(row[2]),
        "history": json.loads(row[3]),
        "next_car_id": row[4],
    }


def save_state(settings, time, queue, history, next_car_id):
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO app_state (
                id,
                settings,
                time,
                queue,
                history,
                next_car_id
            )
            VALUES (1, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                settings = excluded.settings,
                time = excluded.time,
                queue = excluded.queue,
                history = excluded.history,
                next_car_id = excluded.next_car_id
            """,
            (
                json.dumps(settings, ensure_ascii=False),
                time,
                json.dumps(queue, ensure_ascii=False),
                json.dumps(history, ensure_ascii=False),
                next_car_id,
            ),
        )

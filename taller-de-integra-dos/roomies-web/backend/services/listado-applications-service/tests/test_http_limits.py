import asyncio

import pytest

from backend.service_runtime.http import RequestLimits


@pytest.mark.parametrize("path,size,status", [
    ("/api/publicaciones", 26_000_000, 204),
    ("/api/publicaciones/7", 26_000_000, 204),
    ("/api/publicaciones", 26_000_001, 413),
    ("/local/v1/perfil", 6 * 1024 * 1024 + 1, 413),
])
def test_upload_limits_count_actual_chunks_and_keep_profile_limit(path, size, status):
    async def scenario():
        remaining = size
        messages = []
        async def receive():
            nonlocal remaining
            count = min(remaining, 1_000_000)
            remaining -= count
            return {"type": "http.request", "body": b"x" * count, "more_body": remaining > 0}
        async def send(message):
            messages.append(message)
        async def app(scope, receive, send):
            request = await receive()
            assert len(request["body"]) == size
            assert not request["more_body"]
            await send({"type": "http.response.start", "status": 204, "headers": []})
            await send({"type": "http.response.body", "body": b""})
        await RequestLimits(app)({"type": "http", "method": "PUT", "path": path}, receive, send)
        assert messages[0]["status"] == status
    asyncio.run(scenario())

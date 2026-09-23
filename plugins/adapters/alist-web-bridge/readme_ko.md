# AList Web 브리지

운영자가 관리하는 AList 서비스 바인딩을 위한 isolated-worker 참고 어댑터입니다.

AList 소스는 수정하지 않으며 공개 포트를 추가하거나 자격 증명을 포함하지 않습니다. Core가 승인된 바인딩과 헤더 필터링을 제공합니다. `GET`/`HEAD`는 상대 경로를 읽고, `POST`는 `/api/fs/list`, `/api/fs/get`, `/api/fs/search`로 제한되며 JSON 본문은 64 KiB 이하입니다.

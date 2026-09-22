# Mihomo Web 브리지

`mihomo-web-bridge`는 운영자가 관리하는 Mihomo 제어 API를 위한 제한된 CarMediaHub 어댑터입니다.

Mihomo 소스 코드를 수정하지 않고, 추가 공개 포트를 열지 않으며, 브라우저 자격 증명을 전달하지 않고, WebSocket 트래픽 실시간 패널을 제공하지 않습니다. 첫 계약은 Core 서비스 바인딩을 통해 제한된 JSON 제어 경로 `/configs`, `/proxies`, `/providers`, `/rules`, `/connections`, `/version`만 전달합니다.

서비스 바인딩은 운영자가 명시적으로 구성해야 합니다. 어댑터는 로컬 서비스를 자동 검색하거나 자격 증명을 추론하지 않습니다.
